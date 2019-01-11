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
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "child_process", "rxjs"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var child_process_1 = require("child_process");
    var rxjs_1 = require("rxjs");
    function runBazel(projectDir, executable, command, workspaceTarget, flags) {
        var doneSubject = new rxjs_1.Subject();
        var buildProcess = child_process_1.spawn(executable, tslib_1.__spread([command, workspaceTarget], flags), {
            cwd: projectDir,
            stdio: 'inherit',
            shell: false,
        });
        buildProcess.once('close', function (code) {
            if (code === 0) {
                doneSubject.next();
            }
            else {
                doneSubject.error(executable + " failed with code " + code + ".");
            }
        });
        return doneSubject.asObservable();
    }
    exports.runBazel = runBazel;
    function checkInstallation(executable, projectDir) {
        var child = child_process_1.spawnSync(executable, ['version'], {
            cwd: projectDir,
            shell: false,
        });
        return child.status === 0;
    }
    exports.checkInstallation = checkInstallation;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLCtDQUErQztJQUMvQyw2QkFBeUM7SUFLekMsU0FBZ0IsUUFBUSxDQUNwQixVQUFrQixFQUFFLFVBQXNCLEVBQUUsT0FBZ0IsRUFBRSxlQUF1QixFQUNyRixLQUFlO1FBQ2pCLElBQU0sV0FBVyxHQUFHLElBQUksY0FBTyxFQUFRLENBQUM7UUFDeEMsSUFBTSxZQUFZLEdBQUcscUJBQUssQ0FBQyxVQUFVLG9CQUFHLE9BQU8sRUFBRSxlQUFlLEdBQUssS0FBSyxHQUFHO1lBQzNFLEdBQUcsRUFBRSxVQUFVO1lBQ2YsS0FBSyxFQUFFLFNBQVM7WUFDaEIsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQUM7UUFFSCxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxVQUFDLElBQVk7WUFDdEMsSUFBSSxJQUFJLEtBQUssQ0FBQyxFQUFFO2dCQUNkLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUNwQjtpQkFBTTtnQkFDTCxXQUFXLENBQUMsS0FBSyxDQUFJLFVBQVUsMEJBQXFCLElBQUksTUFBRyxDQUFDLENBQUM7YUFDOUQ7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILE9BQU8sV0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO0lBQ3BDLENBQUM7SUFuQkQsNEJBbUJDO0lBRUQsU0FBZ0IsaUJBQWlCLENBQUMsVUFBc0IsRUFBRSxVQUFrQjtRQUMxRSxJQUFNLEtBQUssR0FBRyx5QkFBUyxDQUFDLFVBQVUsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQy9DLEdBQUcsRUFBRSxVQUFVO1lBQ2YsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFORCw4Q0FNQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9J25vZGUnLz5cbmltcG9ydCB7c3Bhd24sIHNwYXduU3luY30gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQge09ic2VydmFibGUsIFN1YmplY3R9IGZyb20gJ3J4anMnO1xuXG5leHBvcnQgdHlwZSBFeGVjdXRhYmxlID0gJ2JhemVsJyB8ICdpYmF6ZWwnO1xuZXhwb3J0IHR5cGUgQ29tbWFuZCA9ICdidWlsZCcgfCAndGVzdCcgfCAncnVuJyB8ICdjb3ZlcmFnZScgfCAncXVlcnknO1xuXG5leHBvcnQgZnVuY3Rpb24gcnVuQmF6ZWwoXG4gICAgcHJvamVjdERpcjogc3RyaW5nLCBleGVjdXRhYmxlOiBFeGVjdXRhYmxlLCBjb21tYW5kOiBDb21tYW5kLCB3b3Jrc3BhY2VUYXJnZXQ6IHN0cmluZyxcbiAgICBmbGFnczogc3RyaW5nW10pOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgY29uc3QgZG9uZVN1YmplY3QgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xuICBjb25zdCBidWlsZFByb2Nlc3MgPSBzcGF3bihleGVjdXRhYmxlLCBbY29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0LCAuLi5mbGFnc10sIHtcbiAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICBzaGVsbDogZmFsc2UsXG4gIH0pO1xuXG4gIGJ1aWxkUHJvY2Vzcy5vbmNlKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgZG9uZVN1YmplY3QubmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb25lU3ViamVjdC5lcnJvcihgJHtleGVjdXRhYmxlfSBmYWlsZWQgd2l0aCBjb2RlICR7Y29kZX0uYCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gZG9uZVN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0luc3RhbGxhdGlvbihleGVjdXRhYmxlOiBFeGVjdXRhYmxlLCBwcm9qZWN0RGlyOiBzdHJpbmcpIHtcbiAgY29uc3QgY2hpbGQgPSBzcGF3blN5bmMoZXhlY3V0YWJsZSwgWyd2ZXJzaW9uJ10sIHtcbiAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgc2hlbGw6IGZhbHNlLFxuICB9KTtcbiAgcmV0dXJuIGNoaWxkLnN0YXR1cyA9PT0gMDtcbn1cbiJdfQ==