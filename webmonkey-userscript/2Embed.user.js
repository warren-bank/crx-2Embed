// ==UserScript==
// @name         2Embed
// @description  For specific video server hosts, open iframe in top window.
// @version      1.0.1
// @match        *://2embed.ru/*
// @match        *://*.2embed.ru/*
// @icon         https://www.2embed.ru/images/favicon.png
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-2Embed/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-2Embed/issues
// @downloadURL  https://github.com/warren-bank/crx-2Embed/raw/webmonkey-userscript/es5/webmonkey-userscript/2Embed.user.js
// @updateURL    https://github.com/warren-bank/crx-2Embed/raw/webmonkey-userscript/es5/webmonkey-userscript/2Embed.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "script_init_delay": 500
}

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr = new unsafeWindow.XMLHttpRequest()
  xhr.open("GET", url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  xhr.send()
}

var download_json = function(url, headers, callback) {
  download_text(url, headers, function(text){
    try {
      callback(JSON.parse(text))
    }
    catch(e) {}
  })
}

// -----------------------------------------------------------------------------

var cancel_event = function(event){
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

// ----------------------------------------------------------------------------- rewrite page content

var rewrite_dom = function() {
  var servers, $body, $select, $iframe, html, server_id, server_name

  servers = unsafeWindow.document.querySelectorAll('a.dropdown-item.item-server[data-id]')
  if (!servers.length) return

  unsafeWindow.document.close()
  unsafeWindow.document.open()
  unsafeWindow.document.write('<div><select></select></div>')
  unsafeWindow.document.write('<div><iframe src="about:blank" width="100%" height="600" scrolling="no" frameborder="0" src="" allowFullScreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe></div>')
  unsafeWindow.document.close()

  $body   = unsafeWindow.document.body
  $select = unsafeWindow.document.querySelector('select')
  $iframe = unsafeWindow.document.querySelector('iframe')

  html = []
  html.push('<option value="">Choose Video Host:</option>')
  for (var i=0; i < servers.length; i++) {
    server_id   = servers[i].getAttribute('data-id')
    server_name = servers[i].innerHTML.trim()

    html.push('<option value="' + server_id + '">' + server_name + '</option>')
  }
  $select.innerHTML = html.join("\n")

  $select.addEventListener('change', function(event){
    cancel_event(event)

    var xhr_url, video_host_url, sites_to_open_in_top_window_regex

    server_id     = $select.value
    $select.value = ''
    if (!server_id) return

    xhr_url = 'https://www.2embed.ru/ajax/embed/play?_token=&id=' + server_id

    download_json(xhr_url, null, function(data){
      if (data && (typeof data === 'object') && data.link) {
        video_host_url = data.link

        sites_to_open_in_top_window_regex = /(?:upstream\.to)\//i

        if (sites_to_open_in_top_window_regex.test(video_host_url)) {
          redirect_to_url(video_host_url)
        }
        else {
          $iframe.setAttribute('src', video_host_url)
        }
      }
    })
  })
}

// ----------------------------------------------------------------------------- bootstrap

var clear_all_timeouts = function() {
  var maxId = unsafeWindow.setTimeout(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearTimeout(i)
  }
}

var clear_all_intervals = function() {
  var maxId = unsafeWindow.setInterval(function(){}, 1000)

  for (var i=0; i <= maxId; i++) {
    unsafeWindow.clearInterval(i)
  }
}

var override_hooks = function() {
  //unsafeWindow.onbeforeunload = cancel_event
}

var init = function() {
  rewrite_dom()
  clear_all_timeouts()
  clear_all_intervals()
  override_hooks()
}

unsafeWindow.setTimeout(
  init,
  user_options.script_init_delay
)

// -----------------------------------------------------------------------------
