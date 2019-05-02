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
        define("@angular/bazel/src/schematics/utility/workspace-utils", ["require", "exports", "@schematics/angular/utility/json-utils", "@angular/bazel/src/schematics/utility/json-utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var json_utils_1 = require("@schematics/angular/utility/json-utils");
    var json_utils_2 = require("@angular/bazel/src/schematics/utility/json-utils");
    /**
     * Find the e2e architect node in the JSON ast.
     * The e2e application is relocated alongside the existing application.
     * This function supports looking up the e2e architect in both the new and old
     * layout.
     * See https://github.com/angular/angular-cli/pull/13780
     */
    function findE2eArchitect(ast, name) {
        var projects = json_utils_1.findPropertyInAstObject(ast, 'projects');
        if (!json_utils_2.isJsonAstObject(projects)) {
            return null;
        }
        var architect;
        var e2e = json_utils_1.findPropertyInAstObject(projects, name + "-e2e");
        if (json_utils_2.isJsonAstObject(e2e)) {
            architect = json_utils_1.findPropertyInAstObject(e2e, 'architect');
        }
        else {
            var project = json_utils_1.findPropertyInAstObject(projects, name);
            if (!json_utils_2.isJsonAstObject(project)) {
                return null;
            }
            architect = json_utils_1.findPropertyInAstObject(project, 'architect');
        }
        if (!json_utils_2.isJsonAstObject(architect)) {
            return null;
        }
        return architect;
    }
    exports.findE2eArchitect = findE2eArchitect;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlLXV0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYmF6ZWwvc3JjL3NjaGVtYXRpY3MvdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7SUFHSCxxRUFBK0U7SUFDL0UsK0VBQTZDO0lBRTdDOzs7Ozs7T0FNRztJQUNILFNBQWdCLGdCQUFnQixDQUFDLEdBQWtCLEVBQUUsSUFBWTtRQUMvRCxJQUFNLFFBQVEsR0FBRyxvQ0FBdUIsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLDRCQUFlLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLENBQUM7U0FDYjtRQUNELElBQUksU0FBMkIsQ0FBQztRQUNoQyxJQUFNLEdBQUcsR0FBRyxvQ0FBdUIsQ0FBQyxRQUFRLEVBQUssSUFBSSxTQUFNLENBQUMsQ0FBQztRQUM3RCxJQUFJLDRCQUFlLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDeEIsU0FBUyxHQUFHLG9DQUF1QixDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQztTQUN2RDthQUFNO1lBQ0wsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3hELElBQUksQ0FBQyw0QkFBZSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUM3QixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsU0FBUyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztTQUMzRDtRQUNELElBQUksQ0FBQyw0QkFBZSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQy9CLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBcEJELDRDQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0Tm9kZSwgSnNvbkFzdE9iamVjdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3R9IGZyb20gJy4vanNvbi11dGlscyc7XG5cbi8qKlxuICogRmluZCB0aGUgZTJlIGFyY2hpdGVjdCBub2RlIGluIHRoZSBKU09OIGFzdC5cbiAqIFRoZSBlMmUgYXBwbGljYXRpb24gaXMgcmVsb2NhdGVkIGFsb25nc2lkZSB0aGUgZXhpc3RpbmcgYXBwbGljYXRpb24uXG4gKiBUaGlzIGZ1bmN0aW9uIHN1cHBvcnRzIGxvb2tpbmcgdXAgdGhlIGUyZSBhcmNoaXRlY3QgaW4gYm90aCB0aGUgbmV3IGFuZCBvbGRcbiAqIGxheW91dC5cbiAqIFNlZSBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9hbmd1bGFyLWNsaS9wdWxsLzEzNzgwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmaW5kRTJlQXJjaGl0ZWN0KGFzdDogSnNvbkFzdE9iamVjdCwgbmFtZTogc3RyaW5nKTogSnNvbkFzdE9iamVjdHxudWxsIHtcbiAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChhc3QsICdwcm9qZWN0cycpO1xuICBpZiAoIWlzSnNvbkFzdE9iamVjdChwcm9qZWN0cykpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICBsZXQgYXJjaGl0ZWN0OiBKc29uQXN0Tm9kZXxudWxsO1xuICBjb25zdCBlMmUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cywgYCR7bmFtZX0tZTJlYCk7XG4gIGlmIChpc0pzb25Bc3RPYmplY3QoZTJlKSkge1xuICAgIGFyY2hpdGVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZSwgJ2FyY2hpdGVjdCcpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cywgbmFtZSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QocHJvamVjdCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBhcmNoaXRlY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0LCAnYXJjaGl0ZWN0Jyk7XG4gIH1cbiAgaWYgKCFpc0pzb25Bc3RPYmplY3QoYXJjaGl0ZWN0KSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIHJldHVybiBhcmNoaXRlY3Q7XG59XG4iXX0=