import { resolve } from "path";
import fs from "fs-extra";
import { bike } from "./bike";
import type { Conf } from "./getConfig";

const cwd = process.cwd();

export const test = (conf: Conf) => {
  conf.entry = resolve(conf.out!, "index.ts");
  if (!conf.watch) {
    conf.start = true;
  }

  const files: string[] = [];
  let waitGroup = 0;
  const reg = new RegExp(conf.match);

  function findTests(dir: string) {
    waitGroup += 1;
    fs.readdir(dir).then((list) => {
      list.forEach((file) => {
        waitGroup += 1;
        const p = resolve(dir, file);
        fs.stat(p).then((stat) => {
          if (stat.isDirectory()) {
            findTests(p);
          } else if (reg.test(file)) {
            files.push(p);
          }
          waitGroup -= 1;
        });
      });
      waitGroup -= 1;
    });
  }

  if (!fs.existsSync(conf.out!)) {
    fs.mkdirpSync(conf.out!);
  }

  async function createCode() {
    findTests(resolve(cwd, conf.src));
    await new Promise((res) => {
      const stop = setInterval(() => {
        if (waitGroup == 0) {
          clearInterval(stop);
          res(void 0);
        }
      }, 20);
    });
    const code = files.map((file) => `import "${file}";`).join("\n");
    await fs.writeFile(
      conf.entry!,
      `${code}

global.bikeTestAll = ${conf.all};
global.bikeReporter = "${conf.reporter || "none"}";
`
    );
  }

  let createdCoded = false;

  async function before() {
    if (!createdCoded || conf.rematch) {
      await createCode();
      createdCoded = true;
    }
  }

  bike({ ...conf, before });
};