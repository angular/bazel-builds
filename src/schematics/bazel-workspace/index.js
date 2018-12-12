/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for bazel-workspace
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("angular/packages/bazel/src/schematics/bazel-workspace/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/latest-versions", "@schematics/angular/utility/validation"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var config_1 = require("@schematics/angular/utility/config");
    var latest_versions_1 = require("@schematics/angular/utility/latest-versions");
    var validation_1 = require("@schematics/angular/utility/validation");
    /**
     * Look for package.json file for package with `packageName` in node_modules and
     * extract its version.
     */
    function findVersion(projectName, packageName, host) {
        var e_1, _a;
        // Need to look in multiple locations because we could be working in a subtree.
        var candidates = [
            "node_modules/" + packageName + "/package.json",
            projectName + "/node_modules/" + packageName + "/package.json",
        ];
        try {
            for (var candidates_1 = tslib_1.__values(candidates), candidates_1_1 = candidates_1.next(); !candidates_1_1.done; candidates_1_1 = candidates_1.next()) {
                var candidate = candidates_1_1.value;
                if (host.exists(candidate)) {
                    try {
                        var packageJson = JSON.parse(host.read(candidate).toString());
                        if (packageJson.name === packageName && packageJson.version) {
                            return packageJson.version;
                        }
                    }
                    catch (_b) {
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (candidates_1_1 && !candidates_1_1.done && (_a = candidates_1.return)) _a.call(candidates_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return null;
    }
    /**
     * Clean the version string and return version in the form "1.2.3". Return
     * null if version string is invalid. This is similar to semver.clean() but
     * takes characters like '^' and '~' into account.
     */
    function clean(version) {
        var matches = version.match(/(\d+\.\d+\.\d+)/);
        return matches && matches.pop() || null;
    }
    exports.clean = clean;
    function default_1(options) {
        return function (host, context) {
            if (!options.name) {
                throw new schematics_1.SchematicsException("Invalid options, \"name\" is required.");
            }
            validation_1.validateProjectName(options.name);
            var newProjectRoot = '';
            try {
                var workspace = config_1.getWorkspace(host);
                newProjectRoot = workspace.newProjectRoot || '';
            }
            catch (_a) {
            }
            var appDir = newProjectRoot + "/" + options.name;
            // If the project already has some deps installed, Bazel should use existing
            // versions.
            var existingVersions = {
                Angular: findVersion(options.name, '@angular/core', host),
                RxJs: findVersion(options.name, 'rxjs', host),
            };
            Object.keys(existingVersions).forEach(function (name) {
                var version = existingVersions[name];
                if (version) {
                    context.logger.info("Bazel will reuse existing version for " + name + ": " + version);
                }
            });
            var workspaceVersions = {
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
                'RXJS_VERSION': existingVersions.RxJs || clean(latest_versions_1.latestVersions.RxJs),
                // TODO(kyliau): Consider moving this to latest-versions.ts
                'RULES_SASS_VERSION': '1.15.1',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' }, workspaceVersions)),
                schematics_1.move(appDir),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsV0FBbUIsRUFBRSxJQUFVOztRQUN2RSwrRUFBK0U7UUFDL0UsSUFBTSxVQUFVLEdBQUc7WUFDakIsa0JBQWdCLFdBQVcsa0JBQWU7WUFDdkMsV0FBVyxzQkFBaUIsV0FBVyxrQkFBZTtTQUMxRCxDQUFDOztZQUNGLEtBQXdCLElBQUEsZUFBQSxpQkFBQSxVQUFVLENBQUEsc0NBQUEsOERBQUU7Z0JBQS9CLElBQU0sU0FBUyx1QkFBQTtnQkFDbEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUMxQixJQUFJO3dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO3dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7NEJBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQzt5QkFDNUI7cUJBQ0Y7b0JBQUMsV0FBTTtxQkFDUDtpQkFDRjthQUNGOzs7Ozs7Ozs7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsU0FBZ0IsS0FBSyxDQUFDLE9BQWU7UUFDbkMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pELE9BQU8sT0FBTyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDMUMsQ0FBQztJQUhELHNCQUdDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxnQ0FBbUIsQ0FBQyx3Q0FBc0MsQ0FBQyxDQUFDO2FBQ3ZFO1lBQ0QsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4QixJQUFJO2dCQUNGLElBQU0sU0FBUyxHQUFHLHFCQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLGNBQWMsR0FBRyxTQUFTLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQzthQUNqRDtZQUFDLFdBQU07YUFDUDtZQUNELElBQU0sTUFBTSxHQUFNLGNBQWMsU0FBSSxPQUFPLENBQUMsSUFBTSxDQUFDO1lBRW5ELDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBaUM7Z0JBQ3JELE9BQU8sRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUUsSUFBSSxDQUFDO2dCQUN6RCxJQUFJLEVBQUUsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQzthQUM5QyxDQUFDO1lBRUYsTUFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLElBQXdCO2dCQUM3RCxJQUFNLE9BQU8sR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdkMsSUFBSSxPQUFPLEVBQUU7b0JBQ1gsT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsMkNBQXlDLElBQUksVUFBSyxPQUFTLENBQUMsQ0FBQztpQkFDbEY7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQU0saUJBQWlCLEdBQUc7Z0JBQ3hCLGlCQUFpQixFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsZ0NBQWMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLGdDQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNuRSwyREFBMkQ7Z0JBQzNELG9CQUFvQixFQUFFLFFBQVE7YUFDL0IsQ0FBQztZQUVGLE9BQU8sc0JBQVMsQ0FBQyxrQkFBSyxDQUFDLGdCQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3JDLDJCQUFjLG9CQUNaLEtBQUssRUFBRSxjQUFPLElBQ1gsT0FBTyxJQUNWLEtBQUssRUFBRSxHQUFHLElBQUssaUJBQWlCLEVBQ2hDO2dCQUNGLGlCQUFJLENBQUMsTUFBTSxDQUFDO2FBQ2IsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUM7SUFDSixDQUFDO0lBNUNELDRCQTRDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBiYXplbC13b3Jrc3BhY2VcbiAqL1xuXG5pbXBvcnQge3N0cmluZ3N9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBtZXJnZVdpdGgsIG1vdmUsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtsYXRlc3RWZXJzaW9uc30gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2xhdGVzdC12ZXJzaW9ucyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtTY2hlbWEgYXMgQmF6ZWxXb3Jrc3BhY2VPcHRpb25zfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuLyoqXG4gKiBMb29rIGZvciBwYWNrYWdlLmpzb24gZmlsZSBmb3IgcGFja2FnZSB3aXRoIGBwYWNrYWdlTmFtZWAgaW4gbm9kZV9tb2R1bGVzIGFuZFxuICogZXh0cmFjdCBpdHMgdmVyc2lvbi5cbiAqL1xuZnVuY3Rpb24gZmluZFZlcnNpb24ocHJvamVjdE5hbWU6IHN0cmluZywgcGFja2FnZU5hbWU6IHN0cmluZywgaG9zdDogVHJlZSk6IHN0cmluZ3xudWxsIHtcbiAgLy8gTmVlZCB0byBsb29rIGluIG11bHRpcGxlIGxvY2F0aW9ucyBiZWNhdXNlIHdlIGNvdWxkIGJlIHdvcmtpbmcgaW4gYSBzdWJ0cmVlLlxuICBjb25zdCBjYW5kaWRhdGVzID0gW1xuICAgIGBub2RlX21vZHVsZXMvJHtwYWNrYWdlTmFtZX0vcGFja2FnZS5qc29uYCxcbiAgICBgJHtwcm9qZWN0TmFtZX0vbm9kZV9tb2R1bGVzLyR7cGFja2FnZU5hbWV9L3BhY2thZ2UuanNvbmAsXG4gIF07XG4gIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICBpZiAoaG9zdC5leGlzdHMoY2FuZGlkYXRlKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKGhvc3QucmVhZChjYW5kaWRhdGUpLnRvU3RyaW5nKCkpO1xuICAgICAgICBpZiAocGFja2FnZUpzb24ubmFtZSA9PT0gcGFja2FnZU5hbWUgJiYgcGFja2FnZUpzb24udmVyc2lvbikge1xuICAgICAgICAgIHJldHVybiBwYWNrYWdlSnNvbi52ZXJzaW9uO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIHtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQ2xlYW4gdGhlIHZlcnNpb24gc3RyaW5nIGFuZCByZXR1cm4gdmVyc2lvbiBpbiB0aGUgZm9ybSBcIjEuMi4zXCIuIFJldHVyblxuICogbnVsbCBpZiB2ZXJzaW9uIHN0cmluZyBpcyBpbnZhbGlkLiBUaGlzIGlzIHNpbWlsYXIgdG8gc2VtdmVyLmNsZWFuKCkgYnV0XG4gKiB0YWtlcyBjaGFyYWN0ZXJzIGxpa2UgJ14nIGFuZCAnficgaW50byBhY2NvdW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xlYW4odmVyc2lvbjogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBtYXRjaGVzID0gdmVyc2lvbi5tYXRjaCgvKFxcZCtcXC5cXGQrXFwuXFxkKykvKTtcbiAgcmV0dXJuIG1hdGNoZXMgJiYgbWF0Y2hlcy5wb3AoKSB8fCBudWxsO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBCYXplbFdvcmtzcGFjZU9wdGlvbnMpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBJbnZhbGlkIG9wdGlvbnMsIFwibmFtZVwiIGlzIHJlcXVpcmVkLmApO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG4gICAgbGV0IG5ld1Byb2plY3RSb290ID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZSA9IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICAgIG5ld1Byb2plY3RSb290ID0gd29ya3NwYWNlLm5ld1Byb2plY3RSb290IHx8ICcnO1xuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgICBjb25zdCBhcHBEaXIgPSBgJHtuZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9YDtcblxuICAgIC8vIElmIHRoZSBwcm9qZWN0IGFscmVhZHkgaGFzIHNvbWUgZGVwcyBpbnN0YWxsZWQsIEJhemVsIHNob3VsZCB1c2UgZXhpc3RpbmdcbiAgICAvLyB2ZXJzaW9ucy5cbiAgICBjb25zdCBleGlzdGluZ1ZlcnNpb25zOiB7W2s6IHN0cmluZ106IHN0cmluZyB8IG51bGx9ID0ge1xuICAgICAgQW5ndWxhcjogZmluZFZlcnNpb24ob3B0aW9ucy5uYW1lLCAnQGFuZ3VsYXIvY29yZScsIGhvc3QpLFxuICAgICAgUnhKczogZmluZFZlcnNpb24ob3B0aW9ucy5uYW1lLCAncnhqcycsIGhvc3QpLFxuICAgIH07XG5cbiAgICBPYmplY3Qua2V5cyhleGlzdGluZ1ZlcnNpb25zKS5mb3JFYWNoKChuYW1lOiAnQW5ndWxhcicgfCAnUnhKcycpID0+IHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBleGlzdGluZ1ZlcnNpb25zW25hbWVdO1xuICAgICAgaWYgKHZlcnNpb24pIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhgQmF6ZWwgd2lsbCByZXVzZSBleGlzdGluZyB2ZXJzaW9uIGZvciAke25hbWV9OiAke3ZlcnNpb259YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VWZXJzaW9ucyA9IHtcbiAgICAgICdBTkdVTEFSX1ZFUlNJT04nOiBleGlzdGluZ1ZlcnNpb25zLkFuZ3VsYXIgfHwgY2xlYW4obGF0ZXN0VmVyc2lvbnMuQW5ndWxhciksXG4gICAgICAnUlhKU19WRVJTSU9OJzogZXhpc3RpbmdWZXJzaW9ucy5SeEpzIHx8IGNsZWFuKGxhdGVzdFZlcnNpb25zLlJ4SnMpLFxuICAgICAgLy8gVE9ETyhreWxpYXUpOiBDb25zaWRlciBtb3ZpbmcgdGhpcyB0byBsYXRlc3QtdmVyc2lvbnMudHNcbiAgICAgICdSVUxFU19TQVNTX1ZFUlNJT04nOiAnMS4xNS4xJyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe1xuICAgICAgICB1dGlsczogc3RyaW5ncyxcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgJ2RvdCc6ICcuJywgLi4ud29ya3NwYWNlVmVyc2lvbnMsXG4gICAgICB9KSxcbiAgICAgIG1vdmUoYXBwRGlyKSxcbiAgICBdKSk7XG4gIH07XG59XG4iXX0=