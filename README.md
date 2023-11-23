# kingDOM
KingDOM, The innerHTML Alternative.

```
// kingdom.js will render and re-render innerHTML in any element with diff and ZERO virtual DOM.
// The render is blazing fast and will apply complex changes without slowdown or memory/events leaks.
// That means your html always stays up to date with zero chance of DOM confusion.

<div id="root"></div>

Initial Content: <script> $html('#root', '<span>step 1</span>'); </script>
Result: <div id="root"><span>step 1</span></div>

Update innerText: <script> $html('#root span', 'step 2'); </script>
Result: <div id="root"><span>step 2</span></div>

Remove Span: <script> $html('#root', 'step 3'); </script>
Result: <div id="root">step 3</div>
```
