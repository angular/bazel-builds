/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
    exports.isJsonAstObject = exports.removeKeyValueInAstObject = exports.replacePropertyInAstObject = void 0;
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
                    var match = content.slice(end).match(/^[,\s]+/);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianNvbi11dGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2JhemVsL3NyYy9zY2hlbWF0aWNzL3V0aWxpdHkvanNvbi11dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBSUgscUVBQStFO0lBRS9FOzs7T0FHRztJQUNILFNBQWdCLDBCQUEwQixDQUN0QyxRQUF3QixFQUFFLElBQW1CLEVBQUUsWUFBb0IsRUFBRSxLQUFnQixFQUNyRixNQUFrQjtRQUFsQix1QkFBQSxFQUFBLFVBQWtCO1FBQ3BCLElBQU0sUUFBUSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUM3RCxJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFhLFlBQVksb0NBQWlDLENBQUMsQ0FBQztTQUM3RTtRQUNNLElBQUEsS0FBSyxHQUFVLFFBQVEsTUFBbEIsRUFBRSxJQUFJLEdBQUksUUFBUSxLQUFaLENBQWE7UUFDL0IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzQyxJQUFNLFNBQVMsR0FBRyxJQUFJO1lBQ2xCLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdkIsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDNUUsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFiRCxnRUFhQztJQUVEOzs7T0FHRztJQUNILFNBQWdCLHlCQUF5QixDQUNyQyxRQUF3QixFQUFFLE9BQWUsRUFBRSxJQUFtQixFQUFFLEdBQVc7OztZQUM3RSxLQUF3QixJQUFBLEtBQUEsaUJBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBQSxnQkFBQSw0QkFBRTtnQkFBeEMsSUFBQSxLQUFBLDJCQUFTLEVBQVIsQ0FBQyxRQUFBLEVBQUUsSUFBSSxRQUFBO2dCQUNqQixJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsRUFBRTtvQkFDMUIsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7b0JBQ2hDLElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO29CQUM1QixJQUFJLFFBQU0sR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDO29CQUN6QixJQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDbEQsSUFBSSxLQUFLLEVBQUU7d0JBQ1QsUUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLEVBQUcsQ0FBQyxNQUFNLENBQUM7cUJBQy9CO29CQUNELFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFFBQU0sQ0FBQyxDQUFDO29CQUMvQixJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsRUFBRyxnQkFBZ0I7d0JBQ3ZELElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQzt3QkFDZixPQUFPLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUU7NEJBQ3hELE1BQU0sRUFBRSxDQUFDO3lCQUNWO3dCQUNELFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztxQkFDekM7b0JBQ0QsT0FBTztpQkFDUjthQUNGOzs7Ozs7Ozs7SUFDSCxDQUFDO0lBdEJELDhEQXNCQztJQUVEOztPQUVHO0lBQ0gsU0FBZ0IsZUFBZSxDQUFDLElBQXNCO1FBQ3BELE9BQU8sQ0FBQyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQztJQUMxQyxDQUFDO0lBRkQsMENBRUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0Tm9kZSwgSnNvbkFzdE9iamVjdCwgSnNvblZhbHVlfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1VwZGF0ZVJlY29yZGVyfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5cbi8qKlxuICogUmVwbGFjZSB0aGUgdmFsdWUgb2YgdGhlIGtleS12YWx1ZSBwYWlyIGluIHRoZSAnbm9kZScgb2JqZWN0IHdpdGggYSBkaWZmZXJlbnRcbiAqICd2YWx1ZScgYW5kIHJlY29yZCB0aGUgdXBkYXRlIHVzaW5nIHRoZSBzcGVjaWZpZWQgJ3JlY29yZGVyJy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgIHJlY29yZGVyOiBVcGRhdGVSZWNvcmRlciwgbm9kZTogSnNvbkFzdE9iamVjdCwgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlOiBKc29uVmFsdWUsXG4gICAgaW5kZW50OiBudW1iZXIgPSAwKSB7XG4gIGNvbnN0IHByb3BlcnR5ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qobm9kZSwgcHJvcGVydHlOYW1lKTtcbiAgaWYgKHByb3BlcnR5ID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eU5hbWV9JyBkb2VzIG5vdCBleGlzdCBpbiBKU09OIG9iamVjdGApO1xuICB9XG4gIGNvbnN0IHtzdGFydCwgdGV4dH0gPSBwcm9wZXJ0eTtcbiAgcmVjb3JkZXIucmVtb3ZlKHN0YXJ0Lm9mZnNldCwgdGV4dC5sZW5ndGgpO1xuICBjb25zdCBpbmRlbnRTdHIgPSAnXFxuJyArXG4gICAgICAnICcucmVwZWF0KGluZGVudCk7XG4gIGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgJyAgJykucmVwbGFjZSgvXFxuL2csIGluZGVudFN0cik7XG4gIHJlY29yZGVyLmluc2VydExlZnQoc3RhcnQub2Zmc2V0LCBjb250ZW50KTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgdGhlIGtleS12YWx1ZSBwYWlyIHdpdGggdGhlIHNwZWNpZmllZCAna2V5JyBpbiB0aGUgc3BlY2lmaWVkICdub2RlJ1xuICogb2JqZWN0IGFuZCByZWNvcmQgdGhlIHVwZGF0ZSB1c2luZyB0aGUgc3BlY2lmaWVkICdyZWNvcmRlcicuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KFxuICAgIHJlY29yZGVyOiBVcGRhdGVSZWNvcmRlciwgY29udGVudDogc3RyaW5nLCBub2RlOiBKc29uQXN0T2JqZWN0LCBrZXk6IHN0cmluZykge1xuICBmb3IgKGNvbnN0IFtpLCBwcm9wXSBvZiBub2RlLnByb3BlcnRpZXMuZW50cmllcygpKSB7XG4gICAgaWYgKHByb3Aua2V5LnZhbHVlID09PSBrZXkpIHtcbiAgICAgIGNvbnN0IHN0YXJ0ID0gcHJvcC5zdGFydC5vZmZzZXQ7XG4gICAgICBjb25zdCBlbmQgPSBwcm9wLmVuZC5vZmZzZXQ7XG4gICAgICBsZXQgbGVuZ3RoID0gZW5kIC0gc3RhcnQ7XG4gICAgICBjb25zdCBtYXRjaCA9IGNvbnRlbnQuc2xpY2UoZW5kKS5tYXRjaCgvXlssXFxzXSsvKTtcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBsZW5ndGggKz0gbWF0Y2gucG9wKCkhLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJlY29yZGVyLnJlbW92ZShzdGFydCwgbGVuZ3RoKTtcbiAgICAgIGlmIChpID09PSBub2RlLnByb3BlcnRpZXMubGVuZ3RoIC0gMSkgeyAgLy8gbGFzdCBwcm9wZXJ0eVxuICAgICAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICAgICAgd2hpbGUgKC8oLHxcXHMpLy50ZXN0KGNvbnRlbnQuY2hhckF0KHN0YXJ0IC0gb2Zmc2V0IC0gMSkpKSB7XG4gICAgICAgICAgb2Zmc2V0Kys7XG4gICAgICAgIH1cbiAgICAgICAgcmVjb3JkZXIucmVtb3ZlKHN0YXJ0IC0gb2Zmc2V0LCBvZmZzZXQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgc3BlY2lmaWVkICdub2RlJyBpcyBhIEpzb25Bc3RPYmplY3QsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzSnNvbkFzdE9iamVjdChub2RlOiBKc29uQXN0Tm9kZXxudWxsKTogbm9kZSBpcyBKc29uQXN0T2JqZWN0IHtcbiAgcmV0dXJuICEhbm9kZSAmJiBub2RlLmtpbmQgPT09ICdvYmplY3QnO1xufVxuIl19