import * as bip39 from "bip39";
import { HDNodeWallet, Mnemonic } from "ethers";
import crypto from "crypto"; 
import { Keypair } from "@solana/web3.js";
import { derivePath } from "ed25519-hd-key";
// import TronWeb from "tronweb";
import * as bitcoin from "bitcoinjs-lib";
import rippleKeypairs from "ripple-keypairs";
import { TronWeb } from 'tronweb';

const log = (msg) => process.send({ type: "log", message: msg });
const checkpoint = (index) => process.send({ type: "checkpoint", index: index });

const sendStats = (speed, total, progress, limit, lastAddr, lastPhrase) => process.send({ 
  type: "stats", 
  data: { 
    speed, 
    total, 
    progress, 
    limit,
    lastCheckedAddress: lastAddr,
    lastCheckedPhrase: lastPhrase
  } 
});

// UTXO Network Configurations
const NETWORKS = {
    BTC: bitcoin.networks.bitcoin,
    LTC: { bech32: 'ltc', pubKeyHash: 0x30, scriptHash: 0x32, wif: 0xb0 },
    DOGE: { pubKeyHash: 0x1e, scriptHash: 0x16, wif: 0x9e }
};

// --- HIGH-SPEED CHECKSUM PRE-VALIDATOR ---
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

const factorial = (n) => (n <= 1 ? 1 : n * factorial(n - 1));

function* heapPermute(arr) {
  const n = arr.length;
  const c = new Array(n).fill(0);
  const a = [...arr];
  yield [...a];
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      const k = i % 2 === 0 ? 0 : c[i];
      [a[k], a[i]] = [a[i], a[k]];
      yield [...a];
      c[i]++;
      i = 0;
    } else {
      c[i] = 0;
      i++;
    }
  }
}

(async () => {
    let found = false; // Global flag to stop all recursion
  const targetRaw = process.env.targetAddress || "";
  const targetSet = new Set(
    targetRaw
      .split(",")
      .map((addr) => addr.trim().toLowerCase())
      .filter((addr) => addr.length > 0),
  );

  const words = JSON.parse(process.env.providedWords || "[]");
  const template = JSON.parse(process.env.fixedTemplate || "[]");
  const list = bip39.wordlists.english;

  // Pre-parse paths for the dispatcher
  const derivationPaths = JSON.parse(process.env.derivationPaths || '["m/44\'/60\'/0\'/0/0"]').map(p => {
      const parts = p.split('/');
      return { original: p, purpose: parts[1], coinType: parts[2] };
  });

  // const rawID = parseInt(process.env.THREAD_ID || "0");
  // const threadID = rawID + 1;
  // const totalThreads = parseInt(process.env.threads || "1");

  // const resumeIndex = parseInt(process.env.resumeIndex || "0");
  // const slots = template.map((v, i) => (v === null ? i : null)).filter((v) => v !== null);
  // const movable = words.filter((w) => !template.includes(w));
  // const totalPerms = factorial(movable.length);

  // const rangePerThread = Math.floor(totalPerms / totalThreads);
  // const startRange = rawID * rangePerThread;
  // const endRange = threadID === totalThreads - 1 ? totalPerms : startRange + rangePerThread;

// ///============
  const rawID = parseInt(process.env.THREAD_ID || "0");
const threadID = rawID + 1;
const totalThreads = parseInt(process.env.threads || "1");

const resumeIndex = parseInt(process.env.resumeIndex || "0");

const slots = template
  .map((v, i) => (v === null ? i : null))
  .filter((v) => v !== null);

const templateSet = new Set(template.filter(Boolean));
const movable = words.filter(w => !templateSet.has(w));

const totalPerms = factorial(movable.length);

// ✅ FIXED DISTRIBUTION
const rangePerThread = Math.ceil(totalPerms / totalThreads);

const startRange = rawID * rangePerThread;
const endRange = Math.min(startRange + rangePerThread, totalPerms);

// ////////========

  let count = 0;
  let isResuming = resumeIndex > startRange;
  let startTime = Date.now();

  if (isResuming) {
    log(`🔄 [Thread ${threadID}] RESUMING REORDER: Skipping to permutation ${resumeIndex.toLocaleString()}...`);
    process.send({ type: "isResuming", value: true });
  } else {
    log(`🚀 [Thread ${threadID}] REORDER START: Range ${startRange.toLocaleString()} to ${endRange.toLocaleString()}`);
    process.send({ type: "isResuming", value: false });
  }

  // for (let p of heapPermute(movable)) {
  //   count++;

  //   if (count < startRange) continue;
  //   if (count > endRange) break;

  //   if (count % 500 === 0) checkpoint(count);

  //   if (isResuming && count >= resumeIndex) {
  //     isResuming = false;
  //     startTime = Date.now();
  //     log(`▶️ [Thread ${threadID}] Resume point reached. Continuing reorder search...`);
  //     process.send({ type: "isResuming", value: false });
  //   }

  //   if (count % 500 === 0) {
  //     const elapsed = (Date.now() - startTime) / 1000;
  //     const activeCount = isResuming ? 0 : resumeIndex > 0 ? count - resumeIndex : count - startRange;
  //     const speed = Math.floor(activeCount / (elapsed || 1));
  //     const progress = ((count / totalPerms) * 100).toFixed(2);
      
  //     process.send({ type: "isResuming", value: isResuming });
  //     // Build a preview of the current phrase for stats
  //     let candPreview = [...template];
  //     slots.forEach((s, i) => (candPreview[s] = p[i]));
  //     sendStats(speed * totalThreads, count, progress, totalPerms, `Worker_${threadID}_Active`, candPreview.slice(0,3).join(' ') + "...");
  //   }

  //   if (count < resumeIndex) continue;

  //   let cand = [...template];
  //   slots.forEach((s, i) => (cand[s] = p[i]));
  //   let phrase = cand.join(" ");

  //   if (isChecksumValid(phrase, list)) {
  //     try {
  //       const seed = bip39.mnemonicToSeedSync(phrase);
  //       const rootNode = HDNodeWallet.fromSeed(seed);
        
  //       for (const pObj of derivationPaths) {
  //         let addr = "";

  //         switch (pObj.coinType) {
  //           case "501'": { // SOLANA
  //             const derived = derivePath(pObj.original, seed.toString('hex'));
  //             addr = Keypair.fromSeed(derived.key.slice(0, 32)).publicKey.toBase58();
  //             break;
  //           }
  //           case "195'": { // TRON
  //             const child = rootNode.derivePath(pObj.original);
  //             addr = TronWeb.address.fromHex(child.address);
  //             break;
  //           }
  //           case "0'": case "2'": case "3'": { // BTC / LTC / DOGE
  //             const net = (pObj.coinType === "0'") ? NETWORKS.BTC : (pObj.coinType === "2'") ? NETWORKS.LTC : NETWORKS.DOGE;
  //             const child = rootNode.derivePath(pObj.original);
  //             const pubkey = Buffer.from(child.publicKey.slice(2), 'hex');
  //             if (pObj.purpose === "84'") addr = bitcoin.payments.p2wpkh({ pubkey, network: net }).address;
  //             else if (pObj.purpose === "49'") {
  //               const { redeem } = bitcoin.payments.p2wpkh({ pubkey, network: net });
  //               addr = bitcoin.payments.p2sh({ redeem, network: net }).address;
  //             } else addr = bitcoin.payments.p2pkh({ pubkey, network: net }).address;
  //             break;
  //           }
  //           case "144'": { // RIPPLE
  //             const child = rootNode.derivePath(pObj.original);
  //             addr = rippleKeypairs.deriveAddress(child.publicKey.slice(2));
  //             break;
  //           }
  //           default: { // EVM
  //             const child = rootNode.derivePath(pObj.original);
  //             addr = child.address;
  //           }
  //         }

  //         if (targetSet.has(addr.toLowerCase())) {
  //           const elapsed = (Date.now() - startTime) / 1000;
  //           const progress = ((count / totalPerms) * 100).toFixed(4);
  //           const totalSpeed = Math.floor(count / (elapsed || 1)) * totalThreads;

  //           log(`=====================================================================================================`);
  //           log(`🎯 MATCH FOUND!!`);
  //           log(`🎉 Congratulations! A matching address was found in Thread ${threadID}!`);
  //           log(`=====================================================================================================`);
  //           log(`✅ MATCH: ${addr}`);
  //           log(`✅ AT PERMUTATION: ${count.toLocaleString()} (${progress}%)`);
  //           log(`✅ TOTAL SPEED: ${totalSpeed.toLocaleString()} perms/s`);
  //           log(`✅ PHRASE: ${phrase}`);
  //           log(`✅ PATH USED: ${pObj.original}`);
  //           log(`=====================================================================================================`);
  //           log(`🌙 Match found. System will enter Auto-Sleep in 30s to save hardware...`);
  //          log("match_found_complete")
  //           setTimeout(() => process.exit(0), 0);
  //           return;
  //         }
  //       }
  //     } catch (e) {}
  //   }

  //   if (count % 500 === 0) {
  //     await new Promise((r) => setImmediate(r));
  //   }
  // }

  // --- Helper: Get N-th permutation of array (lexicographic) ---
function getPermutationByIndex(arr, n) {
  const a = [...arr];
  const result = [];
  const factorials = [1];

  for (let i = 1; i <= a.length; i++) factorials[i] = factorials[i - 1] * i;

  for (let i = a.length; i > 0; i--) {
    const f = factorials[i - 1];
    const index = Math.floor(n / f);
    n %= f;
    result.push(a.splice(index, 1)[0]);
  }

  return result;
}

// --- Updated threaded loop ---
for (let count = startRange; count < endRange; count++) {
  if (found) break; // 2. Exit the loop immediately if found becomes true
  const p = getPermutationByIndex(movable, count);

  if (count % 500 === 0) checkpoint(count);

  if (isResuming && count >= resumeIndex) {
    isResuming = false;
    startTime = Date.now();
    log(`▶️ [Thread ${threadID}] Resume point reached. Continuing reorder search...`);
    process.send({ type: "isResuming", value: false });
  }

  if (count % 500 === 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    const activeCount = isResuming ? 0 : resumeIndex > 0 ? count - resumeIndex : count - startRange;
    const speed = Math.floor(activeCount / (elapsed || 1));
    const progress = ((count / totalPerms) * 100).toFixed(2);

    process.send({ type: "isResuming", value: isResuming });

    // Build a preview of the current phrase for stats
    let candPreview = [...template];
    slots.forEach((s, i) => (candPreview[s] = p[i]));
    // sendStats(
    //   speed * totalThreads,
    //   count,
    //   progress,
    //   totalPerms,
    //  `[Thread ${threadID}] Active || ${progress}%  Scaning.....`,
    //   candPreview.slice(0, 7).join(" ") + " *** *** *** *** *** ***  ***  ***  *** "
    // );
  }

  if (count < resumeIndex) continue;

  // Build candidate phrase
  let cand = [...template];
  slots.forEach((s, i) => (cand[s] = p[i]));
  let phrase = cand.join(" ");

  if (isChecksumValid(phrase, list)) {
    try {
      const seed = bip39.mnemonicToSeedSync(phrase);
      const rootNode = HDNodeWallet.fromSeed(seed);

      for (const pObj of derivationPaths) {
        if (found) break; // 3. Break out of derivation paths if found
        let addr = "";

        switch (pObj.coinType) {
          case "501'": { // SOLANA
            const derived = derivePath(pObj.original, seed.toString("hex"));
            addr = Keypair.fromSeed(derived.key.slice(0, 32)).publicKey.toBase58();
            break;
          }
          // case "195'": { // TRON
          //   const child = rootNode.derivePath(pObj.original);
          //   addr = TronWeb.address.fromHex(child.address);
          //   break;
          // }
              case "195'": { // TRON
            try {
              // We use the TronWeb static method to generate the account from the phrase
              // This ensures the address matches exactly what you just tested
              const tronAccount = TronWeb.fromMnemonic(phrase, pObj.original);
              addr = tronAccount.address; 
            } catch (e) {
              // Fallback logic: Convert Ethers hex (0x...) to Tron hex (41...) then to Base58
              const childTRON = rootNode.derivePath(pObj.original);
              const ethAddr = childTRON.address; // e.g., 0x...
              const tronHex = '41' + ethAddr.slice(2); 
              
              const utils = TronWeb.address || TronWeb.default?.address;
              addr = utils.fromHex(tronHex);
            }
            break;
          }
          case "0'":
          case "2'":
          case "3'": { // BTC / LTC / DOGE
            const net =
              pObj.coinType === "0'"
                ? NETWORKS.BTC
                : pObj.coinType === "2'"
                ? NETWORKS.LTC
                : NETWORKS.DOGE;
            const child = rootNode.derivePath(pObj.original);
            const pubkey = Buffer.from(child.publicKey.slice(2), "hex");

            if (pObj.purpose === "84'") addr = bitcoin.payments.p2wpkh({ pubkey, network: net }).address;
            else if (pObj.purpose === "49'") {
              const { redeem } = bitcoin.payments.p2wpkh({ pubkey, network: net });
              addr = bitcoin.payments.p2sh({ redeem, network: net }).address;
            } else addr = bitcoin.payments.p2pkh({ pubkey, network: net }).address;
            break;
          }
          case "144'": { // RIPPLE
            const child = rootNode.derivePath(pObj.original);
            addr = rippleKeypairs.deriveAddress(child.publicKey.slice(2));
            break;
          }
          default: { // EVM
            const child = rootNode.derivePath(pObj.original);
            addr = child.address;
          }
        }

      

        const elapsed = (Date.now() - startTime) / 1000;
        const progress = ((count / totalPerms) * 100).toFixed(2);
        const speed = Math.floor(count / (elapsed || 1));
        //const spinner = ['|', '/', '-', '\\'][Math.floor(checkedCount / 100) % 4];  
        // Add this right before sendStats
const frames = ['|', '/', '-', '\\'];
const spinner = frames[Math.floor(count / 500) % 4];
        
if(found) return;

    sendStats(
      speed * totalThreads,
      count * totalThreads,
      progress,
      totalPerms,
      // `${spinner}|[${addr}]||${spinner}[Path]${pObj.original} ${spinner} [Mnemonic] ${phrase.split(' ').slice(0, 8).join(' ')} | ***`,
       `${threadID}${spinner}|[${addr}]||${spinner}[Path]${pObj.original} ${spinner} [Mnemonic] ${phrase.split(' ').slice(0, 8).join(' ')} | ***`,
     `${spinner} ${spinner}`,
    );
//log(`🔍 [Thread ${threadID}] Checked: ${addr} at permutation ${count.toLocaleString()} (${((count / totalPerms) * 100).toFixed(2)}%) - Path: ${pObj.original} - Phrase Preview: ${phrase.split(' ').slice(0, 8).join(' ')} ***`);
        if (targetSet.has(addr.toLowerCase())) {
          found = true; // 4. Set flag to true immediately
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = ((count / totalPerms) * 100).toFixed(4);
          const totalSpeed = Math.floor(count / (elapsed || 1)) * totalThreads;

          const startedAt = new Date(startTime).toLocaleTimeString();

     const totalTimeStr = elapsed < 60 
  ? `${elapsed.toFixed(3)}s` // Show 3 decimal places if under a minute (e.g., 0.935s)
  : `${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s`;



        log(
                `=====================================================================================================`,
              );
              log("MATCHING ADDRESS FOUND IN THIS THREAD - CHECK FULL DETAILS BELOW:");
              log(`=====================================================================================================`);
              log(`🎯 MATCH FOUND!!`);
              log(
                `🎉 Congratulations! A matching address was found in Thread ${threadID}!`,
              );
              log(
                `=====================================================================================================`,
              );
              log(`✅ MATCH: ${addr}`);
              log(`✅ AT PERMUTATION: ${count.toLocaleString()} per Thread || (${progress}%)`);
              log(`✅ Thread[${threadID}] SPEED: ${speed.toLocaleString()} perms/s`);
              log(`⏱️ TIME ELAPSED: ${elapsed.toFixed(2)}s`);
              log(`✅ TOTAL COMBINATIONS: ${totalPerms.toLocaleString()}`);
              log(`✅ TOTAL THREADS: ${totalThreads}`);
              log(`✅ TOTAL PERMUTATIONS CHECKED: ${(count * totalThreads).toLocaleString()} || rate (${progress}%)`);
              log(`✅ START SINCE: ${startedAt}`);
              log(`⏱️ TOTAL TIME SPENT: ${totalTimeStr}`);
              log(`✅ TOTAL SPEED: ${totalSpeed.toLocaleString()} perms/s`);
              log(`✅ PHRASE: ${phrase}`);
              log(`✅ PATH USED: ${pObj.original}`);
          log(`=====================================================================================================`);
         log(`🌙 Match found. Please check your Desktop for the recovery phrase.`,);
              log(`📂 FILE SAVED:  Desktop/MATCH_FOUND.txt`)
          log("match_found_complete");
          process.send({ type: "match_found_complete" });
              process.exit(0);


          //  // --- FULL MATCH LOG ---
          //     log(
          //       `=====================================================================================================`,
          //     );
          //     log("MATCHING ADDRESS FOUND IN THIS THREAD - CHECK FULL DETAILS BELOW:");
          //     log(`=====================================================================================================`);
          //     log(`🎯 MATCH FOUND!!`);
          //     log(
          //       `🎉 Congratulations! A matching address was found in Thread ${threadID}!`,
          //     );
          //     log(
          //       `=====================================================================================================`,
          //     );
          //     log(`✅ MATCH: ${addr}`);
          //     log(`✅ AT PERMUTATION: ${count.toLocaleString()} per Thread || (${progress}%)`);
          //     log(`✅ Thread[${threadID}] SPEED: ${speed.toLocaleString()} perms/s`);
          //     log(`⏱️ TIME ELAPSED: ${elapsed.toFixed(2)}s`);
          //     log(`✅ TOTAL COMBINATIONS: ${totalCombinations.toLocaleString()}`);
          //     log(`✅ TOTAL THREADS: ${totalThreads}`);
          //     log(`✅ TOTAL PERMUTATIONS CHECKED: ${(count * totalThreads).toLocaleString()} || rate (${progress}%)`);
          //     log(`✅ START SINCE: ${startedAt}`);
          //     log(`⏱️ TOTAL TIME SPENT: ${totalTimeStr}`);
          //     log(`✅ TOTAL SPEED: ${totalSpeed.toLocaleString()} perms/s`);
          //     log(`✅ PHRASE: ${phrase}`);
          //     log(`✅ PATH USED: ${pObj.original}`);
          //     log(
          //       `=====================================================================================================`,
          //     );
          //     log(
          //       `🌙 Match found. System will enter Auto-Sleep in 30s to save hardware...`,
          //     );
          //     log("match_found_complete");
        }
      }
    } catch (e) {}
  }

  if (count % 500 === 0) await new Promise((r) => setImmediate(r));
}

//log(`🏁 [Thread ${threadID}] Search complete.`);
if (!found) {
    log(`🏁 [Thread ${threadID}] Search complete. Range ${startRange.toLocaleString()} to ${endRange.toLocaleString()} 100% checked. No matches found.`);
  }
})();
