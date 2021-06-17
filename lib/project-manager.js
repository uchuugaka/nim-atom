/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Project = require('./project');
const {isDirectory} = require('./util');

class ProjectManager {
  constructor() {
    this.projectPaths = [];
    this.projects = [];
  }

  destroy() {
    if (this.nonProject != null) { this.nonProject.destroy(); }
    for (let project of Array.from(this.projects)) {
      project.destroy();
    }
    return this.projects = [];
  }

  getProjectForPath(filePath) {
    let found = null;
    for (let project of Array.from(this.projects)) {
      if (filePath.indexOf(project.folderPath) === 0) {
        if (found === null) {
          found = project;
        } else if (found.folderPath.length > project.folderPath.length) {
          found = project;
        }
      }
    }
    if (found != null) {
      return found;
    } else {
      return this.nonProject;
    }
  }

  update(projectPaths, options) {
    this.projectPaths = projectPaths;
    this.destroy();
    this.nonProject = new Project(null, options);
    const projectFolders = projectPaths.filter(isDirectory);
    return this.projects = Array.from(projectFolders).map((projectPath) =>
      new Project(projectPath, options));
  }
}


module.exports = ProjectManager;
