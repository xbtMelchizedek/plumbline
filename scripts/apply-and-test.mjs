#!/usr/bin/env node
/**
 * Download pinned FLOP npm tarballs, verify hashes, apply the #321 and #44
 * patches, and run the offline harnesses. Never talks to a live FLOP
 * endpoint and never signs.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, ".cache");

const CLIENT = {
  name: "@flop-labs/client",
  version: "0.2.2",
  url: "https://registry.npmjs.org/@flop-labs/client/-/client-0.2.2.tgz",
  integrity:
    "sha512-2sN0d2Z6hMTwedD+/EmoiuL1ks6gd2pLLhwrVfG0fFWhIT2j04L53EOlkjNGDcogsPvLsN5qTwUEgqmVyaefWQ==",
  file: "dist/index.js",
  sha256: "e9e6f38b2fc55f85f1fbaeadea00bffe706dfb37171e542c5b446de3b3f48c54",
  patchedSha256:
    "0efe3b8ab6f154425ea0f8635628f259bb882b99dfd8faee59d38a2cd6f20df6",
  patch: "patches/client-0.2.2-receipt-request-id.patch",
};

const CONTRACTS = {
  name: "@flop-labs/contracts",
  version: "0.1.2",
  url: "https://registry.npmjs.org/@flop-labs/contracts/-/contracts-0.1.2.tgz",
  integrity:
    "sha512-6IwLrrapz2jbuFK6slYAK8lLcyEMawEzaRftoTFhdZdABasg580wCdHug2QLABa1D7xyQkq59qhmnUwML7bnNA==",
};

const SDK_HOOKS_SHA256 =
  "7189bb6f6df5ee085def9fbf5e4a6cb31cff62a12c1d497008f2ad9ed2c8a809";
const SDK_PATCH = "patches/sdk-hooks-usebalance-stale-query.patch";

const SDKS = [
  {
    name: "@flop-labs/sdk",
    version: "0.4.0",
    url: "https://registry.npmjs.org/@flop-labs/sdk/-/sdk-0.4.0.tgz",
    integrity:
      "sha512-qC31W4f08qXKpONZDXx2fn9rnaiouBbKrcf5zyzIaFiXk+sD/PT14iko3OJ9LtD398hUBG4tZ/2/Wd9/rss/5A==",
    file: "dist/react/hooks.js",
    sha256: SDK_HOOKS_SHA256,
  },
  {
    name: "@flop-labs/sdk",
    version: "0.6.0",
    url: "https://registry.npmjs.org/@flop-labs/sdk/-/sdk-0.6.0.tgz",
    integrity:
      "sha512-TGzoXtBhyXDsP1ZyPp5a3zzVlB2F7GXSirxxZ4iuDEzlpz22WayxSpq1XRqq/ngLhK0+vvUHP3ygDLpyFAP9zw==",
    file: "dist/react/hooks.js",
    sha256: SDK_HOOKS_SHA256,
  },
];

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha512Integrity(buf) {
  return "sha512-" + createHash("sha512").update(buf).digest("base64");
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `${cmd} ${args.join(" ")} exited ${result.status}${detail ? `\n${detail}` : ""}`,
    );
  }
  return result;
}

async function download(url, dest) {
  const result = spawnSync("curl", ["-fsSL", url, "-o", dest], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`download failed: ${url}\n${result.stderr}`);
  }
}

async function extractTarball(tgz, dest) {
  await mkdir(dest, { recursive: true });
  run("tar", ["-xzf", tgz, "-C", dest]);
}

async function fetchPinned({ url, integrity }, tgzPath) {
  await download(url, tgzPath);
  const buf = await readFile(tgzPath);
  const got = sha512Integrity(buf);
  if (got !== integrity) {
    throw new Error(`integrity mismatch for ${url}\nexpected ${integrity}\nactual   ${got}`);
  }
}

async function applyPatch(cwd, patchFile) {
  const result = spawnSync("git", ["apply", "--check", patchFile], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git apply --check failed in ${cwd}:\n${result.stderr || result.stdout}`);
  }
  run("git", ["apply", patchFile], { cwd });
}

async function main() {
  await rm(CACHE, { recursive: true, force: true });
  await mkdir(CACHE, { recursive: true });

  // --- client #321 ---
  const clientTgz = join(CACHE, "client-0.2.2.tgz");
  const contractsTgz = join(CACHE, "contracts-0.1.2.tgz");
  await fetchPinned(CLIENT, clientTgz);
  await fetchPinned(CONTRACTS, contractsTgz);

  const receiptsRoot = join(CACHE, "receipts");
  await mkdir(receiptsRoot, { recursive: true });
  await extractTarball(clientTgz, join(receiptsRoot, "client"));
  await extractTarball(contractsTgz, join(receiptsRoot, "contracts"));

  const originalJs = join(receiptsRoot, "client/package", CLIENT.file);
  const originalHash = sha256(await readFile(originalJs));
  if (originalHash !== CLIENT.sha256) {
    throw new Error(
      `client dist/index.js SHA-256 mismatch: expected ${CLIENT.sha256}, got ${originalHash}`,
    );
  }

  const candidateDir = join(receiptsRoot, "candidate");
  run("cp", ["-a", join(receiptsRoot, "client/package"), candidateDir]);
  await applyPatch(candidateDir, join(ROOT, CLIENT.patch));
  const patchedHash = sha256(await readFile(join(candidateDir, "dist/index.js")));
  if (patchedHash !== CLIENT.patchedSha256) {
    throw new Error(
      `patched client SHA-256 mismatch: expected ${CLIENT.patchedSha256}, got ${patchedHash}`,
    );
  }
  run("node", ["--check", join(candidateDir, "dist/index.js")]);

  const nm = join(receiptsRoot, "node_modules/@flop-labs");
  await mkdir(nm, { recursive: true });
  await symlink(
    join(receiptsRoot, "contracts/package"),
    join(nm, "contracts"),
    "dir",
  );
  // also place contracts where a package-relative resolve might look
  const clientNm = join(receiptsRoot, "client/package/node_modules/@flop-labs");
  await mkdir(clientNm, { recursive: true });
  await symlink(join(receiptsRoot, "contracts/package"), join(clientNm, "contracts"), "dir");
  const candNm = join(candidateDir, "node_modules/@flop-labs");
  await mkdir(candNm, { recursive: true });
  await symlink(join(receiptsRoot, "contracts/package"), join(candNm, "contracts"), "dir");

  await copyFile(
    join(ROOT, "tests/harness/upstream/test-receipts.mjs"),
    join(receiptsRoot, "test-receipts.mjs"),
  );
  console.log("running #321 receipt harness (26 checks)...");
  run("node", ["--test", "test-receipts.mjs"], { cwd: receiptsRoot, stdio: "inherit" });

  // --- sdk #44, both published versions ---
  let unpatchedFailed = false;
  for (const sdk of SDKS) {
    const tgz = join(CACHE, `sdk-${sdk.version}.tgz`);
    await fetchPinned(sdk, tgz);
    const originalRoot = join(CACHE, `sdk-${sdk.version}-original`);
    const patchedRoot = join(CACHE, `sdk-${sdk.version}-patched`);
    await extractTarball(tgz, originalRoot);
    await extractTarball(tgz, patchedRoot);
    const origHooks = join(originalRoot, "package", sdk.file);
    const got = sha256(await readFile(origHooks));
    if (got !== sdk.sha256) {
      throw new Error(
        `sdk ${sdk.version} ${sdk.file} SHA-256 mismatch: expected ${sdk.sha256}, got ${got}`,
      );
    }
    await applyPatch(join(patchedRoot, "package"), join(ROOT, SDK_PATCH));
    run("node", ["--check", join(patchedRoot, "package", sdk.file)]);

    const env = {
      ...process.env,
      NODE_PATH: join(ROOT, "node_modules"),
    };
    // Harness uses ./package/... relative imports, so copy it next to the
    // extracted package and run from that directory.
    const harnessSrc = join(ROOT, "tests/harness/upstream/balance-regression.mjs");
    await copyFile(harnessSrc, join(patchedRoot, "balance-regression.mjs"));
    console.log(`running #44 regression on patched sdk@${sdk.version}...`);
    run("node", ["--test", "balance-regression.mjs"], {
      cwd: patchedRoot,
      env,
      stdio: "inherit",
    });

    if (sdk.version === "0.6.0") {
      await copyFile(harnessSrc, join(originalRoot, "balance-regression.mjs"));
      const control = spawnSync(
        "node",
        ["--test", "--test-name-pattern", "late old address response cannot overwrite new balance", "balance-regression.mjs"],
        {
          cwd: originalRoot,
          env,
          encoding: "utf8",
        },
      );
      if (control.status === 0) {
        throw new Error(
          "unpatched sdk@0.6.0 unexpectedly passed the late-overwrite control; the published bug may already be fixed",
        );
      }
      unpatchedFailed = true;
      console.log(
        "unpatched sdk@0.6.0 still fails the late-overwrite control (expected).",
      );
    }
  }

  if (!unpatchedFailed) {
    throw new Error("did not observe the unpatched 0.6.0 control failure");
  }

  console.log("apply-and-test: all pinned hashes and harnesses passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
