var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");
const { series, task, dest, watch } = require("gulp");
const spawn = require("child_process").spawn;
let spawnedNode = null;
task("all", function () {
  if (!spawnedNode)
    spawnedNode = spawn("nodemon", ["./examples/node.js"], {
      stdio: "inherit",
      stderr: "inherit",
      stdout: "inherit",
    });
  return tsProject
    .src()
    .pipe(tsProject())
    .js.pipe(dest("dist"))
    .on("end", (error) => {
      console.log("error", error);
    });
});

task("watch", function () {
  watch("src/*.ts", series("all"));
});

task(
  "default",
  series("all", "watch", function (done) {
    done();
  })
);
