// ==UserScript==
// @name         2Embed
// @description  For specific video server hosts, open iframe in top window.
// @version      1.0.5
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

var state = {
  servers: [],

  recaptcha: {
    site_key: null
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
  if (typeof callback !== 'function') return

  unsafeWindow.grecaptcha.execute(state.recaptcha.site_key, {action: 'submit'}).then(function(token) {
    callback(token)
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
  state.recaptcha.site_key = unsafeWindow.document.body.getAttribute('data-recaptcha-key')

  var $servers = unsafeWindow.document.querySelectorAll('a.dropdown-item.item-server[data-id]')
  if ($servers.length) {
    for (var i=0; i < $servers.length; i++) {
      state.servers[i] = {
        id:   $servers[i].getAttribute('data-id'),
        name: $servers[i].innerHTML.trim()
      }
    }
    $servers = null
  }
}

// ----------------------------------------------------------------------------- rewrite page content

var make_option = function(server) {
  var $option
  $option = unsafeWindow.document.createElement('option')
  $option.setAttribute('value', server.id)
  $option.appendChild(
    unsafeWindow.document.createTextNode(server.name)
  )
  return $option
}

var rewrite_dom = function() {
  var $body, $div, $select, $iframe
  var use_iframe

  $body = unsafeWindow.document.body

  while($body.childNodes.length) {
    $body.removeChild($body.childNodes[0])
  }

  $div    = unsafeWindow.document.createElement('div')
  $select = unsafeWindow.document.createElement('select')
  $div.appendChild($select)
  $body.appendChild($div)

  use_iframe = (typeof GM_loadUrl !== 'function')
  if (use_iframe) {
    $div    = unsafeWindow.document.createElement('div')
    $iframe = unsafeWindow.document.createElement('iframe')
    $iframe.setAttribute('src', 'about:blank')
    $iframe.setAttribute('width', '100%')
    $iframe.setAttribute('height', '600')
    $iframe.setAttribute('scrolling', 'no')
    $iframe.setAttribute('frameborder', '0')
    $iframe.setAttribute('allowFullScreen', 'true')
    $iframe.setAttribute('webkitallowfullscreen', 'true')
    $iframe.setAttribute('mozallowfullscreen', 'true')
    $div.appendChild($iframe)
    $body.appendChild($div)
  }

  $select.appendChild(make_option({id: '', name: 'Choose Video Host:'}))
  for (var i=0; i < state.servers.length; i++) {
    $select.appendChild(make_option(state.servers[i]))
  }

  $select.addEventListener('change', function(event){
    cancel_event(event)

    refresh_recaptcha_token(function(token) {
      var xhr_url

      server_id = $select.options[$select.selectedIndex].value
      $select.selectedIndex = 0
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
  if (!state.recaptcha.site_key || !state.servers.length) return

  rewrite_dom()
  clear_all_timeouts()
  clear_all_intervals()
  override_hooks()
}

init()

// -----------------------------------------------------------------------------
