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
        define("@angular/bazel/src/builders/bazel", ["require", "exports", "tslib", "child_process", "path", "rxjs"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    /// <reference types='node'/>
    var child_process_1 = require("child_process");
    var path_1 = require("path");
    var rxjs_1 = require("rxjs");
    function runBazel(projectDir, executable, command, workspaceTarget, flags) {
        var doneSubject = new rxjs_1.Subject();
        var bin = path_1.join(projectDir, 'node_modules', '.bin', executable);
        var buildProcess = child_process_1.spawn(bin, tslib_1.__spread([command, workspaceTarget], flags), {
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
        var bin = path_1.join(projectDir, 'node_modules', '.bin', executable);
        var child = child_process_1.spawnSync(bin, ['version'], {
            cwd: projectDir,
            shell: false,
        });
        return child.status === 0;
    }
    exports.checkInstallation = checkInstallation;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLCtDQUErQztJQUMvQyw2QkFBMEI7SUFDMUIsNkJBQXlDO0lBS3pDLFNBQWdCLFFBQVEsQ0FDcEIsVUFBa0IsRUFBRSxVQUFzQixFQUFFLE9BQWdCLEVBQUUsZUFBdUIsRUFDckYsS0FBZTtRQUNqQixJQUFNLFdBQVcsR0FBRyxJQUFJLGNBQU8sRUFBUSxDQUFDO1FBQ3hDLElBQU0sR0FBRyxHQUFHLFdBQUksQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNqRSxJQUFNLFlBQVksR0FBRyxxQkFBSyxDQUFDLEdBQUcsb0JBQUcsT0FBTyxFQUFFLGVBQWUsR0FBSyxLQUFLLEdBQUc7WUFDcEUsR0FBRyxFQUFFLFVBQVU7WUFDZixLQUFLLEVBQUUsU0FBUztZQUNoQixLQUFLLEVBQUUsS0FBSztTQUNiLENBQUMsQ0FBQztRQUVILFlBQVksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFVBQUMsSUFBWTtZQUN0QyxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7Z0JBQ2QsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDO2FBQ3BCO2lCQUFNO2dCQUNMLFdBQVcsQ0FBQyxLQUFLLENBQUksVUFBVSwwQkFBcUIsSUFBSSxNQUFHLENBQUMsQ0FBQzthQUM5RDtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxXQUFXLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDcEMsQ0FBQztJQXBCRCw0QkFvQkM7SUFFRCxTQUFnQixpQkFBaUIsQ0FBQyxVQUFzQixFQUFFLFVBQWtCO1FBQzFFLElBQU0sR0FBRyxHQUFHLFdBQUksQ0FBQyxVQUFVLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNqRSxJQUFNLEtBQUssR0FBRyx5QkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFO1lBQ3hDLEdBQUcsRUFBRSxVQUFVO1lBQ2YsS0FBSyxFQUFFLEtBQUs7U0FDYixDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFQRCw4Q0FPQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuLy8vIDxyZWZlcmVuY2UgdHlwZXM9J25vZGUnLz5cbmltcG9ydCB7c3Bhd24sIHNwYXduU3luY30gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQge2pvaW59IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHtPYnNlcnZhYmxlLCBTdWJqZWN0fSBmcm9tICdyeGpzJztcblxuZXhwb3J0IHR5cGUgRXhlY3V0YWJsZSA9ICdiYXplbCcgfCAnaWJhemVsJztcbmV4cG9ydCB0eXBlIENvbW1hbmQgPSAnYnVpbGQnIHwgJ3Rlc3QnIHwgJ3J1bicgfCAnY292ZXJhZ2UnIHwgJ3F1ZXJ5JztcblxuZXhwb3J0IGZ1bmN0aW9uIHJ1bkJhemVsKFxuICAgIHByb2plY3REaXI6IHN0cmluZywgZXhlY3V0YWJsZTogRXhlY3V0YWJsZSwgY29tbWFuZDogQ29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0OiBzdHJpbmcsXG4gICAgZmxhZ3M6IHN0cmluZ1tdKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gIGNvbnN0IGRvbmVTdWJqZWN0ID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgY29uc3QgYmluID0gam9pbihwcm9qZWN0RGlyLCAnbm9kZV9tb2R1bGVzJywgJy5iaW4nLCBleGVjdXRhYmxlKTtcbiAgY29uc3QgYnVpbGRQcm9jZXNzID0gc3Bhd24oYmluLCBbY29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0LCAuLi5mbGFnc10sIHtcbiAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICBzaGVsbDogZmFsc2UsXG4gIH0pO1xuXG4gIGJ1aWxkUHJvY2Vzcy5vbmNlKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgZG9uZVN1YmplY3QubmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb25lU3ViamVjdC5lcnJvcihgJHtleGVjdXRhYmxlfSBmYWlsZWQgd2l0aCBjb2RlICR7Y29kZX0uYCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gZG9uZVN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0luc3RhbGxhdGlvbihleGVjdXRhYmxlOiBFeGVjdXRhYmxlLCBwcm9qZWN0RGlyOiBzdHJpbmcpIHtcbiAgY29uc3QgYmluID0gam9pbihwcm9qZWN0RGlyLCAnbm9kZV9tb2R1bGVzJywgJy5iaW4nLCBleGVjdXRhYmxlKTtcbiAgY29uc3QgY2hpbGQgPSBzcGF3blN5bmMoYmluLCBbJ3ZlcnNpb24nXSwge1xuICAgIGN3ZDogcHJvamVjdERpcixcbiAgICBzaGVsbDogZmFsc2UsXG4gIH0pO1xuICByZXR1cm4gY2hpbGQuc3RhdHVzID09PSAwO1xufVxuIl19