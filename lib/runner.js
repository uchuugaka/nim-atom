/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const cp = require('child_process');
class Runner {
  constructor(statusBarViewFn) {
    this.statusBarViewFn = statusBarViewFn;
  }

  run(fullCmd, cb) {
    if (this.process != null) {
      this.waitUntilFinished(this.process.pid);
      this.onKilled = () => this.run(fullCmd, cb);
      return;
    }

    this.onKilled = null;

    return this.process = cp.exec(fullCmd, () => {
      this.process = null;
      if (cb != null) {
        cb();
      }
      if (this.onKilled != null) {
        if (typeof this.statusBarViewFn === 'function') {
          this.statusBarViewFn().clearText();
        }
        return this.onKilled();
      }
    });
  }

  waitUntilFinished(cb) {
    if (this.process != null) {
      __guard__(this.statusBarViewFn(), x => x.showWarning('Nim waiting for running process to close', 0));
      return this.onKilled = cb;
    } else {
      if (cb != null) { return cb(); }
    }
  }
}

module.exports = Runner;
function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}