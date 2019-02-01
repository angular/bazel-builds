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
        var bin = require.resolve("@bazel/" + executable);
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
        var bin;
        try {
            bin = require.resolve("@bazel/" + executable);
        }
        catch (_a) {
            return false;
        }
        var child = child_process_1.spawnSync(bin, ['version'], {
            cwd: projectDir,
            shell: false,
        });
        return child.status === 0;
    }
    exports.checkInstallation = checkInstallation;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6ZWwuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvYmF6ZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsNkJBQTZCO0lBQzdCLCtDQUErQztJQUMvQyw2QkFBeUM7SUFLekMsU0FBZ0IsUUFBUSxDQUNwQixVQUFrQixFQUFFLFVBQXNCLEVBQUUsT0FBZ0IsRUFBRSxlQUF1QixFQUNyRixLQUFlO1FBQ2pCLElBQU0sV0FBVyxHQUFHLElBQUksY0FBTyxFQUFRLENBQUM7UUFDeEMsSUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxZQUFVLFVBQVksQ0FBQyxDQUFDO1FBQ3BELElBQU0sWUFBWSxHQUFHLHFCQUFLLENBQUMsR0FBRyxvQkFBRyxPQUFPLEVBQUUsZUFBZSxHQUFLLEtBQUssR0FBRztZQUNwRSxHQUFHLEVBQUUsVUFBVTtZQUNmLEtBQUssRUFBRSxTQUFTO1lBQ2hCLEtBQUssRUFBRSxLQUFLO1NBQ2IsQ0FBQyxDQUFDO1FBRUgsWUFBWSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsVUFBQyxJQUFZO1lBQ3RDLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtnQkFDZCxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDcEI7aUJBQU07Z0JBQ0wsV0FBVyxDQUFDLEtBQUssQ0FBSSxVQUFVLDBCQUFxQixJQUFJLE1BQUcsQ0FBQyxDQUFDO2FBQzlEO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFFSCxPQUFPLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUNwQyxDQUFDO0lBcEJELDRCQW9CQztJQUVELFNBQWdCLGlCQUFpQixDQUFDLFVBQXNCLEVBQUUsVUFBa0I7UUFDMUUsSUFBSSxHQUFXLENBQUM7UUFDaEIsSUFBSTtZQUNGLEdBQUcsR0FBRyxPQUFPLENBQUMsT0FBTyxDQUFDLFlBQVUsVUFBWSxDQUFDLENBQUM7U0FDL0M7UUFBQyxXQUFNO1lBQ04sT0FBTyxLQUFLLENBQUM7U0FDZDtRQUNELElBQU0sS0FBSyxHQUFHLHlCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDeEMsR0FBRyxFQUFFLFVBQVU7WUFDZixLQUFLLEVBQUUsS0FBSztTQUNiLENBQUMsQ0FBQztRQUNILE9BQU8sS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQVpELDhDQVlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG4vLy8gPHJlZmVyZW5jZSB0eXBlcz0nbm9kZScvPlxuaW1wb3J0IHtzcGF3biwgc3Bhd25TeW5jfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7T2JzZXJ2YWJsZSwgU3ViamVjdH0gZnJvbSAncnhqcyc7XG5cbmV4cG9ydCB0eXBlIEV4ZWN1dGFibGUgPSAnYmF6ZWwnIHwgJ2liYXplbCc7XG5leHBvcnQgdHlwZSBDb21tYW5kID0gJ2J1aWxkJyB8ICd0ZXN0JyB8ICdydW4nIHwgJ2NvdmVyYWdlJyB8ICdxdWVyeSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBydW5CYXplbChcbiAgICBwcm9qZWN0RGlyOiBzdHJpbmcsIGV4ZWN1dGFibGU6IEV4ZWN1dGFibGUsIGNvbW1hbmQ6IENvbW1hbmQsIHdvcmtzcGFjZVRhcmdldDogc3RyaW5nLFxuICAgIGZsYWdzOiBzdHJpbmdbXSk6IE9ic2VydmFibGU8dm9pZD4ge1xuICBjb25zdCBkb25lU3ViamVjdCA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG4gIGNvbnN0IGJpbiA9IHJlcXVpcmUucmVzb2x2ZShgQGJhemVsLyR7ZXhlY3V0YWJsZX1gKTtcbiAgY29uc3QgYnVpbGRQcm9jZXNzID0gc3Bhd24oYmluLCBbY29tbWFuZCwgd29ya3NwYWNlVGFyZ2V0LCAuLi5mbGFnc10sIHtcbiAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgc3RkaW86ICdpbmhlcml0JyxcbiAgICBzaGVsbDogZmFsc2UsXG4gIH0pO1xuXG4gIGJ1aWxkUHJvY2Vzcy5vbmNlKCdjbG9zZScsIChjb2RlOiBudW1iZXIpID0+IHtcbiAgICBpZiAoY29kZSA9PT0gMCkge1xuICAgICAgZG9uZVN1YmplY3QubmV4dCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb25lU3ViamVjdC5lcnJvcihgJHtleGVjdXRhYmxlfSBmYWlsZWQgd2l0aCBjb2RlICR7Y29kZX0uYCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gZG9uZVN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjaGVja0luc3RhbGxhdGlvbihleGVjdXRhYmxlOiBFeGVjdXRhYmxlLCBwcm9qZWN0RGlyOiBzdHJpbmcpIHtcbiAgbGV0IGJpbjogc3RyaW5nO1xuICB0cnkge1xuICAgIGJpbiA9IHJlcXVpcmUucmVzb2x2ZShgQGJhemVsLyR7ZXhlY3V0YWJsZX1gKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGNoaWxkID0gc3Bhd25TeW5jKGJpbiwgWyd2ZXJzaW9uJ10sIHtcbiAgICBjd2Q6IHByb2plY3REaXIsXG4gICAgc2hlbGw6IGZhbHNlLFxuICB9KTtcbiAgcmV0dXJuIGNoaWxkLnN0YXR1cyA9PT0gMDtcbn1cbiJdfQ==