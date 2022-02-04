var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json");
const { series, task, dest } = require("gulp");

task("default", function () {
  return tsProject
    .src()
    .pipe(tsProject())
    .js.pipe(dest("dist"))
    .on("end", (error) => {
      console.log("error", error);
    });
});
