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
    exports.findE2eArchitect = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid29ya3NwYWNlLXV0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvYmF6ZWwvc3JjL3NjaGVtYXRpY3MvdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBR0gscUVBQStFO0lBQy9FLCtFQUE2QztJQUU3Qzs7Ozs7O09BTUc7SUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxHQUFrQixFQUFFLElBQVk7UUFDL0QsSUFBTSxRQUFRLEdBQUcsb0NBQXVCLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyw0QkFBZSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQzlCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxJQUFJLFNBQTJCLENBQUM7UUFDaEMsSUFBTSxHQUFHLEdBQUcsb0NBQXVCLENBQUMsUUFBUSxFQUFLLElBQUksU0FBTSxDQUFDLENBQUM7UUFDN0QsSUFBSSw0QkFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ3hCLFNBQVMsR0FBRyxvQ0FBdUIsQ0FBQyxHQUFHLEVBQUUsV0FBVyxDQUFDLENBQUM7U0FDdkQ7YUFBTTtZQUNMLElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsNEJBQWUsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDN0IsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELFNBQVMsR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7U0FDM0Q7UUFDRCxJQUFJLENBQUMsNEJBQWUsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMvQixPQUFPLElBQUksQ0FBQztTQUNiO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQXBCRCw0Q0FvQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7SnNvbkFzdE5vZGUsIEpzb25Bc3RPYmplY3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3R9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0fSBmcm9tICcuL2pzb24tdXRpbHMnO1xuXG4vKipcbiAqIEZpbmQgdGhlIGUyZSBhcmNoaXRlY3Qgbm9kZSBpbiB0aGUgSlNPTiBhc3QuXG4gKiBUaGUgZTJlIGFwcGxpY2F0aW9uIGlzIHJlbG9jYXRlZCBhbG9uZ3NpZGUgdGhlIGV4aXN0aW5nIGFwcGxpY2F0aW9uLlxuICogVGhpcyBmdW5jdGlvbiBzdXBwb3J0cyBsb29raW5nIHVwIHRoZSBlMmUgYXJjaGl0ZWN0IGluIGJvdGggdGhlIG5ldyBhbmQgb2xkXG4gKiBsYXlvdXQuXG4gKiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvcHVsbC8xMzc4MFxuICovXG5leHBvcnQgZnVuY3Rpb24gZmluZEUyZUFyY2hpdGVjdChhc3Q6IEpzb25Bc3RPYmplY3QsIG5hbWU6IHN0cmluZyk6IEpzb25Bc3RPYmplY3R8bnVsbCB7XG4gIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXN0LCAncHJvamVjdHMnKTtcbiAgaWYgKCFpc0pzb25Bc3RPYmplY3QocHJvamVjdHMpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgbGV0IGFyY2hpdGVjdDogSnNvbkFzdE5vZGV8bnVsbDtcbiAgY29uc3QgZTJlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMsIGAke25hbWV9LWUyZWApO1xuICBpZiAoaXNKc29uQXN0T2JqZWN0KGUyZSkpIHtcbiAgICBhcmNoaXRlY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChlMmUsICdhcmNoaXRlY3QnKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMsIG5hbWUpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KHByb2plY3QpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgYXJjaGl0ZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdCwgJ2FyY2hpdGVjdCcpO1xuICB9XG4gIGlmICghaXNKc29uQXN0T2JqZWN0KGFyY2hpdGVjdCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICByZXR1cm4gYXJjaGl0ZWN0O1xufVxuIl19