import fs from "fs";
import os from "os";
import path from "path";
import { loadNextRuntimeConfig } from "../src/config/nextRuntimeConfig";

describe("loadNextRuntimeConfig", () => {
  it("빌드 manifest의 이미지 설정을 런타임 설정으로 보존한다", () => {
    const appDir = fs.mkdtempSync(path.join(os.tmpdir(), "hebimall-next-config-"));
    const nextDir = path.join(appDir, ".next");
    fs.mkdirSync(nextDir);
    fs.writeFileSync(
      path.join(nextDir, "required-server-files.json"),
      JSON.stringify({
        config: {
          distDir: ".next",
          images: {
            remotePatterns: [
              {
                protocol: "https",
                hostname: "firebasestorage.googleapis.com",
                pathname: "/v0/b/hebimall.firebasestorage.app/o/**",
              },
            ],
          },
        },
      }),
    );

    try {
      const config = loadNextRuntimeConfig(appDir);

      expect(config.distDir).toBe(".next");
      expect(config.images).toEqual({
        remotePatterns: [
          {
            protocol: "https",
            hostname: "firebasestorage.googleapis.com",
            pathname: "/v0/b/hebimall.firebasestorage.app/o/**",
          },
        ],
      });
    } finally {
      fs.rmSync(appDir, { recursive: true, force: true });
    }
  });
});
