/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class NimStatusBarView extends HTMLElement {
  init(timeout) {
    this.timeout = timeout;
    this.classList.add('nim-status-bar', 'inline-block');
    return this.activate();
  }

  activate() {
    return this.textContext = "";
  }
 
  destroy() {
    return clearInterval(this.intervalId);
  }
 
  clearClasses() {
    return this.classList.remove('success', 'info', 'error', 'warning');
  }

  doMessage(text, type, timeout) {
    this.clearClasses();
    this.classList.add(type);
    this.textContent = text;
    if (this.timeoutHandle != null) {
      clearTimeout(this.timeoutHandle);
    }
    const hide = () => this.clearText();
    const ms = (timeout != null) ? timeout : this.timeout;
    if (ms > 0) {
      return this.timeoutHandle = setTimeout(hide, ms);
    }
  }

  showError(text, timeout) { return this.doMessage(text, 'error', timeout); }

  showSuccess(text, timeout) { return this.doMessage(text, 'success', timeout); }

  showInfo(text, timeout) { return this.doMessage(text, 'info', timeout); }

  showWarning(text, timeout) { return this.doMessage(text, 'warning', timeout); }

  

  clearText() {
    this.clearClasses();
    return this.textContent = '';
  }
}
 
module.exports = document.registerElement('nim-status-bar',
  {prototype: NimStatusBarView.prototype, extends: 'div'});