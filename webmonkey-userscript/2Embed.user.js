// ==UserScript==
// @name         2Embed
// @description  For specific video server hosts, open iframe in top window.
// @version      1.0.9
// @include      /^https?:\/\/(?:[^\.\/]*\.)*(?:2embed\.(?:ru|to))\/.*$/
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

var constants = {
  debug:   true,
  verbose: 0,
  reinitialize_document: true,
  reload_on_recaptcha_error: false,
  dom_classes: {
    is_visible: 'show'
  }
}

// ----------------------------------------------------------------------------- global state

var state = {
  did: {
    init: false
  },

  servers: [],

  recaptcha: {
    site_key: null
  }
}

// ----------------------------------------------------------------------------- debug logger

var debug = function(message, verbosity_level) {
  if (!constants.debug) return
  if (verbosity_level && (!constants.verbose || (verbosity_level > constants.verbose))) return

  if (typeof GM_toastShort === 'function') {
    if (Array.isArray(message))
      message = message.join("\n\n")

    GM_toastShort(message)
  }
  else {
    if (Array.isArray(message)) {
      for (var i=0; i < message.length; i++) {
        unsafeWindow.alert(message[i])
      }
    }
    else {
      unsafeWindow.alert(message)
    }
  }
}

// ----------------------------------------------------------------------------- helpers

// make GET request, pass plaintext response to callback
var download_text = function(url, headers, callback) {
  var xhr

  try {
    xhr = new unsafeWindow.XMLHttpRequest()
    xhr.open("GET", url, true, null, null)
  }
  catch(e) {
    debug('XHR initialization error: bad URL')
    return
  }

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
      else {
        debug([xhr.status + ': ' + xhr.responseText, url])
      }
    }
    else {
      debug('XHR state: ' + xhr.readyState, 3)
    }
  }

  xhr.onerror = function(e) {
    debug('XHR error' + (e && (e instanceof Error)) ? ': ' + e.message : '')
  }

  xhr.send()
}

var download_json = function(url, headers, callback) {
  download_text(url, headers, function(text){
    try {
      callback(JSON.parse(text))
    }
    catch(e) {
      debug(['JSON error: failed to parse XHR server response', text])
    }
  })
}

// -----------------------------------------------------------------------------

var resolve_url = function(url) {
  if (url.substring(0, 4).toLowerCase() === 'http')
    return url

  if (url.substring(0, 2) === '//')
    return unsafeWindow.location.protocol + url

  if (url.substring(0, 1) === '/')
    return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + url

  return unsafeWindow.location.protocol + '//' + unsafeWindow.location.host + unsafeWindow.location.pathname.replace(/[^\/]+$/, '') + url
}

// -----------------------------------------------------------------------------

var cancel_event = function(event){
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=false;
}

// -----------------------------------------------------------------------------

var remove_child_elements = function(el) {
  if (!(el instanceof HTMLElement)) return

  while (el.childNodes.length) {
    el.removeChild(el.childNodes[0])
  }
}

var make_element = function(elementName, content, isText) {
  var el = unsafeWindow.document.createElement(elementName)

  if (content) {
    if (isText) {
      el.appendChild(
        unsafeWindow.document.createTextNode(content)
      )
    }
    else {
      el.innerHTML = content
    }
  }

  return el
}

var add_style_element = function(css) {
  if (!css) return

  var head = unsafeWindow.document.getElementsByTagName('head')[0]
  if (!head) return

  if ('function' === (typeof css))
    css = css()
  if (Array.isArray(css))
    css = css.join("\n")

  head.appendChild(
    make_element('style', css, true)
  )
}

// -----------------------------------------------------------------------------

var refresh_recaptcha_token = function(callback) {
  if (!state.recaptcha.site_key) {
    debug('recaptcha site key is undefined')
    return
  }
  if (!unsafeWindow.grecaptcha) {
    debug('recaptcha library is not yet loaded')
    return
  }
  if (typeof callback !== 'function') {
    debug('recaptcha callback function is undefined')
    return
  }

  unsafeWindow.grecaptcha.execute(state.recaptcha.site_key, {action: 'submit'})
  .then(function(token) {
    token = token ? token.toString().trim() : null

    if (!token) {
      debug('recaptcha token is undefined')
      return
    }

    debug('token: ' + token, 2)

    callback(token)
  })
  .catch(function(e) {
    if (constants.reload_on_recaptcha_error) {
      redirect_to_url(unsafeWindow.location.href)
      return
    }

    debug(['failed to obtain recaptcha token', (e ? ((e instanceof Error) ? e.message : e.toString()) : '')])
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

var rewrite_dom = function() {
  if (constants.reinitialize_document) {
    unsafeWindow.document.close()
    unsafeWindow.document.open()
    unsafeWindow.document.write('')
    unsafeWindow.document.close()
  }
  else {
    remove_child_elements(unsafeWindow.document.body)
    remove_child_elements(unsafeWindow.document.getElementsByTagName('head')[0])
  }

  unsafeWindow.grecaptcha = undefined

  add_style_element([
    'body > * {display: none !important}',
    'body > .' + constants.dom_classes.is_visible + ' {display: block !important}'
  ])

  var use_iframe
  var $body, $script, $div, $select, $iframe

  $body = unsafeWindow.document.body

  if (unsafeWindow.grecaptcha === undefined) {
    $script = make_element('script')
    $script.setAttribute('src', 'https://www.google.com/recaptcha/api.js?render=' + state.recaptcha.site_key)
    $script.addEventListener('load', function() {
      unsafeWindow.grecaptcha.ready(recaptcha_ready.bind(null, false))
    })
    $script.className = constants.dom_classes.is_visible
    $body.appendChild($script)
  }
  else {
    unsafeWindow.grecaptcha.ready(recaptcha_ready.bind(null, true))
  }

  $div    = make_element('div')
  $select = make_element('select')
  $div.appendChild($select)
  $div.className = constants.dom_classes.is_visible
  $body.appendChild($div)

  use_iframe = (typeof GM_loadUrl !== 'function')
  if (use_iframe) {
    $div    = make_element('div')
    $iframe = make_element('iframe')
    $iframe.setAttribute('src', 'about:blank')
    $iframe.setAttribute('width', '100%')
    $iframe.setAttribute('height', '600')
    $iframe.setAttribute('scrolling', 'no')
    $iframe.setAttribute('frameborder', '0')
    $iframe.setAttribute('allowFullScreen', 'true')
    $iframe.setAttribute('webkitallowfullscreen', 'true')
    $iframe.setAttribute('mozallowfullscreen', 'true')
    $div.appendChild($iframe)
    $div.className = constants.dom_classes.is_visible
    $body.appendChild($div)
  }

  $select.appendChild(make_option({id: '', name: 'Choose Video Host:'}))
  for (var i=0; i < state.servers.length; i++) {
    $select.appendChild(make_option(state.servers[i]))
  }

  $select.addEventListener('change', function(event){
    cancel_event(event)

    var server_id = $select.options[$select.selectedIndex].value
    debug('server ID: ' + server_id, 3)

    $select.selectedIndex = 0
    if (!server_id) return

    refresh_recaptcha_token(function(token) {
      var xhr_url = resolve_url('/ajax/embed/play?id=') + encodeURIComponent(server_id) + '&_token=' + encodeURIComponent(token)

      debug('XHR URL: ' + xhr_url, 1)

      download_json(xhr_url, null, function(data){
        var video_host_url

        if (data && (typeof data === 'object') && data.link) {
          video_host_url = data.link
          debug('video URL: ' + video_host_url, 1)

          if (use_iframe)
            $iframe.setAttribute('src', video_host_url)
          else
            redirect_to_url(video_host_url)
        }
        else {
          debug(['XHR response has an unexpected JSON data structure', JSON.stringify(data, null, 2)])
        }
      })
    })
  })
}

var recaptcha_ready = function(perform_reset) {
  var $body, $div

  if (perform_reset === true) {
    try {
      unsafeWindow.grecaptcha.reset(state.recaptcha.site_key)
    }
    catch(e) {}
  }
  else {
    $body = unsafeWindow.document.body
    $div  = make_element('div')
    $body.appendChild($div)

    try {
      unsafeWindow.grecaptcha.render($div, {sitekey: state.recaptcha.site_key})
    }
    catch(e) {}
  }
}

var make_option = function(server) {
  var $option
  $option = make_element('option')
  $option.setAttribute('value', server.id)
  $option.appendChild(
    unsafeWindow.document.createTextNode(server.name)
  )
  return $option
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

var init = function() {
  if (('function' === (typeof GM_getUrl)) && (GM_getUrl() !== unsafeWindow.location.href)) {
    redirect_to_url(unsafeWindow.location.href)
    return
  }

  if (unsafeWindow.window.did_userscript_init) return
  unsafeWindow.window.did_userscript_init = true

  if (state.did.init) return
  state.did.init = true

  debug('initializing..', 3)

  scrape_dom()
  if (!state.recaptcha.site_key || !state.servers.length) return

  rewrite_dom()
  clear_all_timeouts()
  clear_all_intervals()
}

init()

// -----------------------------------------------------------------------------
