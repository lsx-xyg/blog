import "dotenv/config";
import { decrypt } from "../lib/crypto";

const CIPHER = "/J+E+Axs+tSb4OI1:HLDRi1aWz06knWv5WguyHHyGQzwuZdHanlJ/Mscj4mMVXtTAzixSPe8A0Js=:I2bbm6yL5IkxDuipQ6VXdA==";

console.log("ENCRYPTION_KEY set:", !!process.env.ENCRYPTION_KEY);
console.log("ENCRYPTION_KEY length:", process.env.ENCRYPTION_KEY?.length);

try {
  const plain = decrypt(CIPHER);
  console.log("decrypted:", JSON.stringify(plain));
  console.log("decrypted length:", plain.length);
  console.log("expected  :", JSON.stringify("ydrBqEJw="));
  console.log("match     :", plain === "ydrBqEJw=");
} catch (e) {
  console.error("decrypt failed:", e);
}