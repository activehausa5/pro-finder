import { Mnemonic, HDNodeWallet, wordlists } from "ethers";

export async function performValidation(phrase) {
    try {
        if (!phrase) return { error: "Empty phrase" };
        
        const cleanPhrase = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
        const words = cleanPhrase.split(' ');
        const isChecksumValid = Mnemonic.isValidMnemonic(cleanPhrase);

        const addresses = {};

        if (isChecksumValid) {
            const mnemonicObj = Mnemonic.fromPhrase(cleanPhrase);
            
            // We map these specifically so the UI knows what is what
            const pathMap = {
                standard: "m/44'/60'/0'/0/0",
                metamask2: "m/44'/60'/0'/0/1",
                metamask3: "m/44'/60'/0'/0/2",
                ledger: "m/44'/60'/1'/0/0",
                legacy: "m/44'/60'/0'/0"
            };

            for (const [key, path] of Object.entries(pathMap)) {
                // Using the syntax from your worker script
                const wallet = HDNodeWallet.fromMnemonic(mnemonicObj, path);
                addresses[key] = wallet.address;
            }
        }

        return {
            allWordsValid: words.every(w => wordlists.en.getWordIndex(w) !== -1),
            checksumValid: isChecksumValid,
            addresses: Object.keys(addresses).length > 0 ? addresses : null,
            wordCount: words.length
        };
    } catch (err) {
        return { error: true, message: err.message };
    }
}