/**
 *  Shows an element that was hidden by the 'hidden' class
 */
window.show = function (id) {
  removeClass(id, 'hidden');
};

/**
 *  Hides a dom element by applying the 'hidden' class
 */
window.hide = function (id){
  var ele = document.getElementById(id);
  if(ele.classList) {
    ele.classList.add('hidden');
  } else {
    ele.className = 'hidden ' + ele.className;
  }
};

/**
 *  Removes a class from a dom element, used by show.
 */
function removeClass(id, className) {
  var ele = document.getElementById(id);
  if (ele.classList) {
    ele.classList.remove(className);
  } else {
    // works in our simple usecase
    ele.className = ele.className.replace(className, '');
  }
}

/**
 *  A simple convenience function to post to the example application server.
 */
window.workshopServerCall = function (urlPart, obj, resolve, reject){
  var xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/' + urlPart);
  xhr.onload = function () {
    if (this.status >= 200 && this.status < 300) {
      if (resolve) {
        resolve(JSON.parse(xhr.responseText || 'null'));
      }
    } else {
      if (reject) {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    }
  };
  xhr.onerror = function () {
    if (reject) {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    }
  };
  xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xhr.send(JSON.stringify(obj));
};
