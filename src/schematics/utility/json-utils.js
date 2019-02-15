/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/src/schematics/utility/json-utils", ["require", "exports", "tslib", "@schematics/angular/utility/json-utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var json_utils_1 = require("@schematics/angular/utility/json-utils");
    /**
     * Replace the value of the key-value pair in the 'node' object with a different
     * 'value' and record the update using the specified 'recorder'.
     */
    function replacePropertyInAstObject(recorder, node, propertyName, value, indent) {
        if (indent === void 0) { indent = 0; }
        var property = json_utils_1.findPropertyInAstObject(node, propertyName);
        if (property === null) {
            throw new Error("Property '" + propertyName + "' does not exist in JSON object");
        }
        var start = property.start, text = property.text;
        recorder.remove(start.offset, text.length);
        var indentStr = '\n' +
            ' '.repeat(indent);
        var content = JSON.stringify(value, null, '  ').replace(/\n/g, indentStr);
        recorder.insertLeft(start.offset, content);
    }
    exports.replacePropertyInAstObject = replacePropertyInAstObject;
    /**
     * Remove the key-value pair with the specified 'key' in the specified 'node'
     * object and record the update using the specified 'recorder'.
     */
    function removeKeyValueInAstObject(recorder, content, node, key) {
        var e_1, _a;
        try {
            for (var _b = tslib_1.__values(node.properties.entries()), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = tslib_1.__read(_c.value, 2), i = _d[0], prop = _d[1];
                if (prop.key.value === key) {
                    var start = prop.start.offset;
                    var end = prop.end.offset;
                    var length_1 = end - start;
                    var match = content.slice(end).match(/[,\s]+/);
                    if (match) {
                        length_1 += match.pop().length;
                    }
                    recorder.remove(start, length_1);
                    if (i === node.properties.length - 1) { // last property
                        var offset = 0;
                        while (/(,|\s)/.test(content.charAt(start - offset - 1))) {
                            offset++;
                        }
                        recorder.remove(start - offset, offset);
                    }
                    return;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    exports.removeKeyValueInAstObject = removeKeyValueInAstObject;
    /**
     * Returns true if the specified 'node' is a JsonAstObject, false otherwise.
     */
    function isJsonAstObject(node) {
        return !!node && node.kind === 'object';
    }
    exports.isJsonAstObject = isJsonAstObject;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi11dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2JhemVsL3NyYy9zY2hlbWF0aWNzL3V0aWxpdHkvanNvbi11dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFJSCxxRUFBK0U7SUFFL0U7OztPQUdHO0lBQ0gsU0FBZ0IsMEJBQTBCLENBQ3RDLFFBQXdCLEVBQUUsSUFBbUIsRUFBRSxZQUFvQixFQUFFLEtBQWdCLEVBQ3JGLE1BQWtCO1FBQWxCLHVCQUFBLEVBQUEsVUFBa0I7UUFDcEIsSUFBTSxRQUFRLEdBQUcsb0NBQXVCLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzdELElBQUksUUFBUSxLQUFLLElBQUksRUFBRTtZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLGVBQWEsWUFBWSxvQ0FBaUMsQ0FBQyxDQUFDO1NBQzdFO1FBQ00sSUFBQSxzQkFBSyxFQUFFLG9CQUFJLENBQWE7UUFDL0IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzQyxJQUFNLFNBQVMsR0FBRyxJQUFJO1lBQ2xCLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkIsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDNUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFiRCxnRUFhQztJQUVEOzs7T0FHRztJQUNILFNBQWdCLHlCQUF5QixDQUNyQyxRQUF3QixFQUFFLE9BQWUsRUFBRSxJQUFtQixFQUFFLEdBQVc7OztZQUM3RSxLQUF3QixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQSxnQkFBQSw0QkFBRTtnQkFBeEMsSUFBQSxnQ0FBUyxFQUFSLFNBQUMsRUFBRSxZQUFJO2dCQUNqQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsRUFBRTtvQkFDMUIsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7b0JBQ2hDLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO29CQUM1QixJQUFJLFFBQU0sR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDO29CQUN6QixJQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDakQsSUFBSSxLQUFLLEVBQUU7d0JBQ1QsUUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUksQ0FBQyxNQUFNLENBQUM7cUJBQ2hDO29CQUNELFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFFBQU0sQ0FBQyxDQUFDO29CQUMvQixJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsRUFBRyxnQkFBZ0I7d0JBQ3ZELElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQzt3QkFDZixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7NEJBQ3hELE1BQU0sRUFBRSxDQUFDO3lCQUNWO3dCQUNELFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztxQkFDekM7b0JBQ0QsT0FBTztpQkFDUjthQUNGOzs7Ozs7Ozs7SUFDSCxDQUFDO0lBdEJELDhEQXNCQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsZUFBZSxDQUFDLElBQXdCO1FBQ3RELE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQztJQUMxQyxDQUFDO0lBRkQsMENBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SnNvbkFzdE5vZGUsIEpzb25Bc3RPYmplY3QsIEpzb25WYWx1ZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtVcGRhdGVSZWNvcmRlcn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuXG4vKipcbiAqIFJlcGxhY2UgdGhlIHZhbHVlIG9mIHRoZSBrZXktdmFsdWUgcGFpciBpbiB0aGUgJ25vZGUnIG9iamVjdCB3aXRoIGEgZGlmZmVyZW50XG4gKiAndmFsdWUnIGFuZCByZWNvcmQgdGhlIHVwZGF0ZSB1c2luZyB0aGUgc3BlY2lmaWVkICdyZWNvcmRlcicuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIsIG5vZGU6IEpzb25Bc3RPYmplY3QsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZTogSnNvblZhbHVlLFxuICAgIGluZGVudDogbnVtYmVyID0gMCkge1xuICBjb25zdCBwcm9wZXJ0eSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KG5vZGUsIHByb3BlcnR5TmFtZSk7XG4gIGlmIChwcm9wZXJ0eSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgJyR7cHJvcGVydHlOYW1lfScgZG9lcyBub3QgZXhpc3QgaW4gSlNPTiBvYmplY3RgKTtcbiAgfVxuICBjb25zdCB7c3RhcnQsIHRleHR9ID0gcHJvcGVydHk7XG4gIHJlY29yZGVyLnJlbW92ZShzdGFydC5vZmZzZXQsIHRleHQubGVuZ3RoKTtcbiAgY29uc3QgaW5kZW50U3RyID0gJ1xcbicgK1xuICAgICAgJyAnLnJlcGVhdChpbmRlbnQpO1xuICBjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsICcgICcpLnJlcGxhY2UoL1xcbi9nLCBpbmRlbnRTdHIpO1xuICByZWNvcmRlci5pbnNlcnRMZWZ0KHN0YXJ0Lm9mZnNldCwgY29udGVudCk7XG59XG5cbi8qKlxuICogUmVtb3ZlIHRoZSBrZXktdmFsdWUgcGFpciB3aXRoIHRoZSBzcGVjaWZpZWQgJ2tleScgaW4gdGhlIHNwZWNpZmllZCAnbm9kZSdcbiAqIG9iamVjdCBhbmQgcmVjb3JkIHRoZSB1cGRhdGUgdXNpbmcgdGhlIHNwZWNpZmllZCAncmVjb3JkZXInLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChcbiAgICByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIsIGNvbnRlbnQ6IHN0cmluZywgbm9kZTogSnNvbkFzdE9iamVjdCwga2V5OiBzdHJpbmcpIHtcbiAgZm9yIChjb25zdCBbaSwgcHJvcF0gb2Ygbm9kZS5wcm9wZXJ0aWVzLmVudHJpZXMoKSkge1xuICAgIGlmIChwcm9wLmtleS52YWx1ZSA9PT0ga2V5KSB7XG4gICAgICBjb25zdCBzdGFydCA9IHByb3Auc3RhcnQub2Zmc2V0O1xuICAgICAgY29uc3QgZW5kID0gcHJvcC5lbmQub2Zmc2V0O1xuICAgICAgbGV0IGxlbmd0aCA9IGVuZCAtIHN0YXJ0O1xuICAgICAgY29uc3QgbWF0Y2ggPSBjb250ZW50LnNsaWNlKGVuZCkubWF0Y2goL1ssXFxzXSsvKTtcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBsZW5ndGggKz0gbWF0Y2gucG9wKCkgIS5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZWNvcmRlci5yZW1vdmUoc3RhcnQsIGxlbmd0aCk7XG4gICAgICBpZiAoaSA9PT0gbm9kZS5wcm9wZXJ0aWVzLmxlbmd0aCAtIDEpIHsgIC8vIGxhc3QgcHJvcGVydHlcbiAgICAgICAgbGV0IG9mZnNldCA9IDA7XG4gICAgICAgIHdoaWxlICgvKCx8XFxzKS8udGVzdChjb250ZW50LmNoYXJBdChzdGFydCAtIG9mZnNldCAtIDEpKSkge1xuICAgICAgICAgIG9mZnNldCsrO1xuICAgICAgICB9XG4gICAgICAgIHJlY29yZGVyLnJlbW92ZShzdGFydCAtIG9mZnNldCwgb2Zmc2V0KTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgdGhlIHNwZWNpZmllZCAnbm9kZScgaXMgYSBKc29uQXN0T2JqZWN0LCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0pzb25Bc3RPYmplY3Qobm9kZTogSnNvbkFzdE5vZGUgfCBudWxsKTogbm9kZSBpcyBKc29uQXN0T2JqZWN0IHtcbiAgcmV0dXJuICEhbm9kZSAmJiBub2RlLmtpbmQgPT09ICdvYmplY3QnO1xufVxuIl19