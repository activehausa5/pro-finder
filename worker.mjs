// --- IMPORTS ---
import * as bip39 from "bip39";
import { HDNodeWallet, Mnemonic } from "ethers";
import crypto from "crypto";
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
// import TronWeb from "tronweb";
import * as bitcoin from "bitcoinjs-lib";
import rippleKeypairs from "ripple-keypairs";
import { TronWeb } from "tronweb";

// --- IPC LOGGING HELPERS ---
const log = (msg) => process.send({ type: "log", message: msg });
const checkpoint = (index) =>
  process.send({ type: "checkpoint", index: index });

const sendStats = (speed, total, progress, limit, lastAddr, lastPhrase) =>
  process.send({
    type: "stats",
    data: {
      speed,
      total,
      progress,
      limit,
      lastCheckedAddress: lastAddr,
      lastCheckedPhrase: lastPhrase,
    },
  });

// --- UTXO Network Configurations ---
const NETWORKS = {
  BTC: bitcoin.networks.bitcoin,
  LTC: { bech32: "ltc", pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 },
  DOGE: { pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e },
};

// --- CHECKSUM VALIDATION ---
function isChecksumValid(phrase, wordlist) {
  try {
    const words = phrase.split(" ");
    let bits = "";
    for (let i = 0; i < words.length; i++) {
      const index = wordlist.indexOf(words[i]);
      if (index === -1) return false;
      bits += index.toString(2).padStart(11, "0");
    }
    const dividerIndex = Math.floor(bits.length / 33) * 32;
    const entropyBits = bits.slice(0, dividerIndex);
    const checksumBits = bits.slice(dividerIndex);
    const entropyBytes = Buffer.from(
      entropyBits.match(/.{1,8}/g).map((byte) => parseInt(byte, 2)),
    );
    const hash = crypto.createHash("sha256").update(entropyBytes).digest();
    const hashBits = hash[0].toString(2).padStart(8, "0");
    return checksumBits === hashBits.slice(0, checksumBits.length);
  } catch (e) {
    return false;
  }
}

// --- MAIN WORKER ---
(async () => {
  let found = false; // Global flag to stop all recursion
  const targetRaw = process.env.targetAddress || "";
  const targetSet = new Set(
    targetRaw
      .split(",")
      .map((addr) => addr.trim().toLowerCase())
      .filter((addr) => addr.length > 0),
  );

  const providedWords = JSON.parse(process.env.providedWords || "[]");
  const indices = JSON.parse(process.env.missingIndices || "[]");
  const list = bip39.wordlists.english;

  const derivationPaths = JSON.parse(
    process.env.derivationPaths || "[\"m/44'/60'/0'/0/0\"]",
  ).map((p) => {
    const parts = p.split("/");
    return { original: p, purpose: parts[1], coinType: parts[2] };
  });

  const rawID = parseInt(process.env.THREAD_ID || "0");
  const threadID = rawID + 1;
  const totalThreads = parseInt(process.env.threads || "1");
  const resumeIndex = parseInt(process.env.resumeIndex || "0");
  const totalCombinations = Math.pow(2048, indices.length);

  // --- LOGIC UPDATE: DISTRIBUTE BY DICTIONARY RANGE ---
  const wordsPerThread = Math.floor(list.length / totalThreads);
  const startWordIdx = rawID * wordsPerThread;
  const endWordIdx = (rawID === totalThreads - 1) ? list.length : startWordIdx + wordsPerThread;

  let checkedCount = 0;
  let isResuming = resumeIndex > 0; // Simplified resume for distributed mode
  let startTime = Date.now();

  log(`🚀 [Thread ${threadID}] ENGINE STARTED: Scanning dictionary words ${startWordIdx} to ${endWordIdx}`);

  

  async function search(currentWords, depth) {
    if (found) return; // Stop immediately if another branch found the match
    if (depth === indices.length) {
      checkedCount++;
      
      // Resume skipping logic
      if (isResuming && checkedCount < resumeIndex) return;
      if (isResuming && checkedCount >= resumeIndex) {
          isResuming = false;
          startTime = Date.now();
          log(`▶️ [Thread ${threadID}] Resume point reached.`);
           process.send({ type: "isResuming", value: false }); 
      }

      if (checkedCount % 500 === 0) checkpoint(checkedCount);

      const phrase = currentWords.join(" ");
      
      if (isChecksumValid(phrase, list)) {
        try {
          const seed = bip39.mnemonicToSeedSync(phrase);
          const rootNode = HDNodeWallet.fromSeed(seed);

          for (const pObj of derivationPaths) {
          if (found) return; // Stop immediately if another branch found the match
          
            let addr = "";

            switch (pObj.coinType) {
              case "501'": {
                const derived = derivePath(pObj.original, seed.toString("hex"));
                addr = Keypair.fromSeed(derived.key.slice(0, 32)).publicKey.toBase58();
                break;
              }
              case "195'": {
                try {
                  const tronAccount = TronWeb.fromMnemonic(phrase, pObj.original);
                  addr = tronAccount.address;
                } catch (e) {
                  const childTRON = rootNode.derivePath(pObj.original);
                  const ethAddr = childTRON.address;
                  const tronHex = "41" + ethAddr.slice(2);
                  const utils = TronWeb.address || TronWeb.default?.address;
                  addr = utils.fromHex(tronHex);
                }
                break;
              }
              case "0'":
              case "2'":
              case "3'": {
                const net = pObj.coinType === "0'" ? NETWORKS.BTC : pObj.coinType === "2'" ? NETWORKS.LTC : NETWORKS.DOGE;
                const child = rootNode.derivePath(pObj.original);
                const pubkey = Buffer.from(child.publicKey.slice(2), "hex");
                if (pObj.purpose === "84'") addr = bitcoin.payments.p2wpkh({ pubkey, network: net }).address;
                else if (pObj.purpose === "49'") {
                  const { redeem } = bitcoin.payments.p2wpkh({ pubkey, network: net });
                  addr = bitcoin.payments.p2sh({ redeem, network: net }).address;
                } else addr = bitcoin.payments.p2pkh({ pubkey, network: net }).address;
                break;
              }
              case "144'": {
                const childXRP = rootNode.derivePath(pObj.original);
                addr = rippleKeypairs.deriveAddress(childXRP.publicKey.slice(2));
                break;
              }
              default: {
                const childEVM = rootNode.derivePath(pObj.original);
                addr = childEVM.address;
              }
            }

            // if (checkedCount % 500 === 0) {
            //   const elapsed = (Date.now() - startTime) / 1000;
            //   const progress = ((checkedCount / (totalCombinations / totalThreads)) * 100).toFixed(2);
            //   const speed = Math.floor(checkedCount / (elapsed || 1));
            //   const spinner = ['|', '/', '-', '\\'][Math.floor(checkedCount / 100) % 4];      

            //   sendStats(
            //     speed * totalThreads,
            //     checkedCount,
            //     progress,
            //     totalCombinations,
            //     `${spinner}[Thread ${threadID}] [${addr.slice(0,8)}...]`,
            //     `Scanning: ${phrase.split(' ').slice(0, 3).join(' ')}...`
            //   );
            // }
              const elapsed = (Date.now() - startTime) / 1000;
              const progress = ((checkedCount / (totalCombinations / totalThreads)) * 100).toFixed(2);
              const speed = Math.floor(checkedCount / (elapsed || 1));
              const spinner = ['|', '/', '-', '\\'][Math.floor(checkedCount / 100) % 4];

              if(found) return;
              
              sendStats(
                speed * totalThreads,
                checkedCount * totalThreads,
                progress,
                totalCombinations,
                `${threadID}${spinner}|[${addr}]||${spinner}[Path]${pObj.original} ${spinner} [Mnemonic] ${phrase.split(' ').slice(0, 8).join(' ')} |**`,
                `${spinner} ${spinner}`,
              );

            if (targetSet.has(addr.toLowerCase())) {
              found = true; // Set the flag to true
            
              const elapsed = (Date.now() - startTime) / 1000;
              const totalTimeStr = elapsed < 60 ? `${elapsed.toFixed(3)}s` : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;
              const progress = ((checkedCount / (totalCombinations / totalThreads)) * 100).toFixed(4);
              const totalSpeed = Math.floor(checkedCount / (elapsed || 1)) * totalThreads;
              const startedAt = new Date(startTime).toLocaleTimeString();
              
              
            // --- FULL MATCH LOG ---
              log(
                `=====================================================================================================`,
              );
              log("MATCHING ADDRESS FOUND IN THIS THREAD - CHECK FULL DETAILS BELOW:");
              log(`=====================================================================================================`);
              log(`🎯 MATCH FOUND!!`);
              log(
                `🎉 Congratulations! A matching address was found in Thread ${threadID}!`,
              );
              log( `=====================================================================================================`,);
              log(`✅ MATCH: ${addr}`);
              log(`✅ AT PERMUTATION: ${checkedCount.toLocaleString()} per Thread || (${progress}%)`);
              log(`✅ Thread[${threadID}] SPEED: ${speed.toLocaleString()} perms/s`);
              log(`⏱️ TIME ELAPSED: ${elapsed.toFixed(2)}s`);
              log(`✅ TOTAL COMBINATIONS: ${totalCombinations.toLocaleString()}`);
              log(`✅ TOTAL THREADS: ${totalThreads}`);
              log(`✅ TOTAL PERMUTATIONS CHECKED: ${(checkedCount * totalThreads).toLocaleString()} || rate (${progress}%)`);
              log(`✅ START SINCE: ${startedAt}`);
              log(`⏱️ TOTAL TIME SPENT: ${totalTimeStr}`);
              log(`✅ TOTAL SPEED: ${totalSpeed.toLocaleString()} perms/s`);
              log(`✅ PHRASE: ${phrase}`);
              log(`✅ PATH USED: ${pObj.original}`);
              log(`=====================================================================================================`, );
              log(`🌙 Match found. Please check your Desktop for the recovery phrase.`,);
              log(`📂 FILE SAVED:  Desktop/MATCH_FOUND.txt`)
              log("match_found_complete");
              process.send({ type: "match_found_complete" });
              process.exit(0);
            }
            return
          }
        } catch (e) {
          log(`⚠️ [Thread ${threadID}] Error during derivation: ${e.message}`);
        }
      }
      return;
    }

    const currentIdx = indices[depth];
    
    // --- UPDATED LOOP: Branching based on Thread ID at the first missing word ---
    let loopStart = 0;
    let loopEnd = list.length;

    if (depth === 0) {
      loopStart = startWordIdx;
      loopEnd = endWordIdx;
    }

    for (let i = loopStart; i < loopEnd; i++) {
      if (found) break; // Exit the loop if match was found elsewhere
      currentWords[currentIdx] = list[i];
      if (i % 250 === 0) await new Promise((r) => setImmediate(r));
      await search(currentWords, depth + 1);
    }
  }

  if (targetSet.size === 0 || providedWords.length === 0 || indices.length === 0) {
    log("❌ FATAL: Missing parameters.");
    process.exit(1);
  }

  await search([...providedWords], 0);
 if (!found) {
  log(`🏁[Thread ${threadID}] Search complete. 100% checked. No matches found.`);
}
})();
