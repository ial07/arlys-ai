"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/humanize-ms@1.2.1";
exports.ids = ["vendor-chunks/humanize-ms@1.2.1"];
exports.modules = {

/***/ "(rsc)/../../node_modules/.pnpm/humanize-ms@1.2.1/node_modules/humanize-ms/index.js":
/*!************************************************************************************!*\
  !*** ../../node_modules/.pnpm/humanize-ms@1.2.1/node_modules/humanize-ms/index.js ***!
  \************************************************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("/*!\n * humanize-ms - index.js\n * Copyright(c) 2014 dead_horse <dead_horse@qq.com>\n * MIT Licensed\n */\n\n\n\n/**\n * Module dependencies.\n */\n\nvar util = __webpack_require__(/*! util */ \"util\");\nvar ms = __webpack_require__(/*! ms */ \"(rsc)/../../node_modules/.pnpm/ms@2.1.3/node_modules/ms/index.js\");\n\nmodule.exports = function (t) {\n  if (typeof t === 'number') return t;\n  var r = ms(t);\n  if (r === undefined) {\n    var err = new Error(util.format('humanize-ms(%j) result undefined', t));\n    console.warn(err.stack);\n  }\n  return r;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL2h1bWFuaXplLW1zQDEuMi4xL25vZGVfbW9kdWxlcy9odW1hbml6ZS1tcy9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVhOztBQUViO0FBQ0E7QUFDQTs7QUFFQSxXQUFXLG1CQUFPLENBQUMsa0JBQU07QUFDekIsU0FBUyxtQkFBTyxDQUFDLDRFQUFJOztBQUVyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIi9Vc2Vycy9tbS9QdWJsaWMvSUFMV29ya3MvQUkvYXJseXMtYWkvbm9kZV9tb2R1bGVzLy5wbnBtL2h1bWFuaXplLW1zQDEuMi4xL25vZGVfbW9kdWxlcy9odW1hbml6ZS1tcy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbiAqIGh1bWFuaXplLW1zIC0gaW5kZXguanNcbiAqIENvcHlyaWdodChjKSAyMDE0IGRlYWRfaG9yc2UgPGRlYWRfaG9yc2VAcXEuY29tPlxuICogTUlUIExpY2Vuc2VkXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIE1vZHVsZSBkZXBlbmRlbmNpZXMuXG4gKi9cblxudmFyIHV0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG52YXIgbXMgPSByZXF1aXJlKCdtcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh0KSB7XG4gIGlmICh0eXBlb2YgdCA9PT0gJ251bWJlcicpIHJldHVybiB0O1xuICB2YXIgciA9IG1zKHQpO1xuICBpZiAociA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcih1dGlsLmZvcm1hdCgnaHVtYW5pemUtbXMoJWopIHJlc3VsdCB1bmRlZmluZWQnLCB0KSk7XG4gICAgY29uc29sZS53YXJuKGVyci5zdGFjayk7XG4gIH1cbiAgcmV0dXJuIHI7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/../../node_modules/.pnpm/humanize-ms@1.2.1/node_modules/humanize-ms/index.js\n");

/***/ })

};
;