// ==UserScript==
// @name         2Embed
// @description  For specific video server hosts, open iframe in top window.
// @version      1.0.4
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

var state = {
  recaptcha: {
    site_key: null,
    token: {
      value:  null,
      expiry: null
    }
  }
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

// -----------------------------------------------------------------------------

var refresh_recaptcha_token = function(callback) {
  if (!state.recaptcha.site_key) return
  if (!unsafeWindow.grecaptcha)  return

  if (state.recaptcha.token.value && state.recaptcha.token.expiry && (state.recaptcha.token.expiry > Date.now())) {
    // current token is still valid

    if (typeof callback === 'function') callback(state.recaptcha.token.value)
    return
  }

  unsafeWindow.grecaptcha.execute(state.recaptcha.site_key, {action: 'submit'}).then(function(token) {
    state.recaptcha.token.value  = token
    state.recaptcha.token.expiry = Date.now() + 120000  // 120,000 ms = (2 mins)(60 secs/min)(1000 ms/sec)

    if (typeof callback === 'function') callback(state.recaptcha.token.value)
  })
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

// ----------------------------------------------------------------------------- extract required information from page content

var scrape_dom = function() {
  var script = unsafeWindow.document.querySelector('script[src^="https://www.google.com/recaptcha/api.js?render="]')
  if (script)
    state.recaptcha.site_key = script.getAttribute('src').replace(/^.*render=([^&]+).*$/, '$1')
}

// ----------------------------------------------------------------------------- rewrite page content

var rewrite_dom = function() {
  var servers, html, use_iframe, $body, $select, $iframe, server_id, server_name

  servers = unsafeWindow.document.querySelectorAll('a.dropdown-item.item-server[data-id]')
  if (!servers.length) return

  html = []
  if (state.recaptcha.site_key)
    html.push('<script src="https://www.google.com/recaptcha/api.js?render=' + state.recaptcha.site_key + '"></script>')
  html.push('<div><select></select></div>')
  use_iframe = (typeof GM_loadUrl !== 'function')
  if (use_iframe)
    html.push('<div><iframe src="about:blank" width="100%" height="600" scrolling="no" frameborder="0" src="" allowFullScreen="true" webkitallowfullscreen="true" mozallowfullscreen="true"></iframe></div>')

  unsafeWindow.document.close()
  unsafeWindow.document.open()
  unsafeWindow.document.write(html.join("\n"))
  unsafeWindow.document.close()

  $body   = unsafeWindow.document.body
  $select = unsafeWindow.document.querySelector('select')
  $iframe = use_iframe ? unsafeWindow.document.querySelector('iframe') : null

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

    refresh_recaptcha_token(function(token) {
      var xhr_url

      server_id     = $select.value
      $select.value = ''
      if (!server_id) return

      xhr_url = 'https://www.2embed.ru/ajax/embed/play?id=' + server_id + '&_token=' + token

      download_json(xhr_url, null, function(data){
        var video_host_url

        if (data && (typeof data === 'object') && data.link) {
          video_host_url = data.link

          if (use_iframe)
            $iframe.setAttribute('src', video_host_url)
          else
            redirect_to_url(video_host_url)
        }
      })
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
  scrape_dom()
  rewrite_dom()
  clear_all_timeouts()
  clear_all_intervals()
  override_hooks()
  refresh_recaptcha_token()
}

unsafeWindow.setTimeout(
  init,
  user_options.script_init_delay
)

// -----------------------------------------------------------------------------
