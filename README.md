### [2Embed](https://github.com/warren-bank/crx-2Embed/tree/webmonkey-userscript/es5)

[Userscript](https://github.com/warren-bank/crx-2Embed/raw/webmonkey-userscript/es5/webmonkey-userscript/2Embed.user.js) to run in both:
* the [WebMonkey](https://github.com/warren-bank/Android-WebMonkey) application for Android
* the [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) web browser extension for Chrome/Chromium

Its purpose is to:
* rewrite pages on the [_2embed.ru_](https://www.2embed.ru/) website
  - replace entire UI with a simple list of the available video hosts
  - when a video host in this list is clicked..
    * in _WebMonkey_:
      - redirect the top window to a page on the website for chosen video host that contains a video player
    * otherwise:
      - load this page in an iframe

#### Legal:

* copyright: [Warren Bank](https://github.com/warren-bank)
* license: [GPL-2.0](https://www.gnu.org/licenses/old-licenses/gpl-2.0.txt)
