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
    function findVersion(packageName, host) {
        var candidate = "node_modules/" + packageName + "/package.json";
        if (host.exists(candidate)) {
            try {
                var packageJson = JSON.parse(host.read(candidate).toString());
                if (packageJson.name === packageName && packageJson.version) {
                    return packageJson.version;
                }
            }
            catch (_a) {
            }
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
    /**
     * Returns true if project contains routing module, false otherwise.
     */
    function hasRoutingModule(host) {
        var hasRouting = false;
        host.visit(function (file) { hasRouting = hasRouting || file.endsWith('-routing.module.ts'); });
        return hasRouting;
    }
    /**
     * Returns true if project uses SASS stylesheets, false otherwise.
     */
    function hasSassStylesheet(host) {
        var hasSass = false;
        // The proper extension for SASS is .scss
        host.visit(function (file) { hasSass = hasSass || file.endsWith('.scss'); });
        return hasSass;
    }
    function default_1(options) {
        return function (host, context) {
            var name = options.name || config_1.getWorkspace(host).defaultProject;
            if (!name) {
                throw new Error('Please provide a name for Bazel workspace');
            }
            validation_1.validateProjectName(name);
            // If the project already has some deps installed, Bazel should use existing
            // versions.
            var existingVersions = {
                Angular: findVersion('@angular/core', host),
                RxJs: findVersion('rxjs', host),
            };
            Object.keys(existingVersions).forEach(function (name) {
                var version = existingVersions[name];
                if (version) {
                    context.logger.info("Bazel will reuse existing version for " + name + ": " + version);
                }
            });
            if (!host.exists('yarn.lock')) {
                host.create('yarn.lock', '');
            }
            var workspaceVersions = {
                'RULES_NODEJS_VERSION': '0.18.6',
                'RULES_NODEJS_SHA256': '1416d03823fed624b49a0abbd9979f7c63bbedfd37890ddecedd2fe25cccebc6',
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
                'RXJS_VERSION': existingVersions.RxJs || clean(latest_versions_1.latestVersions.RxJs),
                // TODO(kyliau): Consider moving this to latest-versions.ts
                'RULES_SASS_VERSION': '1.17.0',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings, name: name, 'dot': '.' }, workspaceVersions, { routing: hasRoutingModule(host), sass: hasSassStylesheet(host) })),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsSUFBVTtRQUNsRCxJQUFNLFNBQVMsR0FBRyxrQkFBZ0IsV0FBVyxrQkFBZSxDQUFDO1FBQzdELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMxQixJQUFJO2dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7b0JBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQztpQkFDNUI7YUFDRjtZQUFDLFdBQU07YUFDUDtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFNBQWdCLEtBQUssQ0FBQyxPQUFlO1FBQ25DLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRCxPQUFPLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFIRCxzQkFHQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO1FBQ2xDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsSUFBWSxJQUFPLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEcsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLElBQVksSUFBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUMvRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQzthQUM5RDtZQUNELGdDQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFCLDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBRztnQkFDdkIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDO2dCQUMzQyxJQUFJLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7YUFDaEMsQ0FBQztZQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUF3QjtnQkFDN0QsSUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFXLENBQUM7Z0JBQ2pELElBQUksT0FBTyxFQUFFO29CQUNYLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLDJDQUF5QyxJQUFJLFVBQUssT0FBUyxDQUFDLENBQUM7aUJBQ2xGO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDOUI7WUFFRCxJQUFNLGlCQUFpQixHQUFHO2dCQUN4QixzQkFBc0IsRUFBRSxRQUFRO2dCQUNoQyxxQkFBcUIsRUFBRSxrRUFBa0U7Z0JBQ3pGLGlCQUFpQixFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsZ0NBQWMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVFLGNBQWMsRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLGdDQUFjLENBQUMsSUFBSSxDQUFDO2dCQUNuRSwyREFBMkQ7Z0JBQzNELG9CQUFvQixFQUFFLFFBQVE7YUFDL0IsQ0FBQztZQUVGLE9BQU8sc0JBQVMsQ0FBQyxrQkFBSyxDQUFDLGdCQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3JDLDJCQUFjLG9CQUNaLEtBQUssRUFBRSxjQUFPLEVBQ2QsSUFBSSxNQUFBLEVBQ0osS0FBSyxFQUFFLEdBQUcsSUFBSyxpQkFBaUIsSUFDaEMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUMvQixJQUFJLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxDQUFDLElBQzdCO2FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUM7SUFDSixDQUFDO0lBN0NELDRCQTZDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBiYXplbC13b3Jrc3BhY2VcbiAqL1xuXG5pbXBvcnQge3N0cmluZ3N9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBtZXJnZVdpdGgsIG1vdmUsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtsYXRlc3RWZXJzaW9uc30gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2xhdGVzdC12ZXJzaW9ucyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtTY2hlbWEgYXMgQmF6ZWxXb3Jrc3BhY2VPcHRpb25zfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuLyoqXG4gKiBMb29rIGZvciBwYWNrYWdlLmpzb24gZmlsZSBmb3IgcGFja2FnZSB3aXRoIGBwYWNrYWdlTmFtZWAgaW4gbm9kZV9tb2R1bGVzIGFuZFxuICogZXh0cmFjdCBpdHMgdmVyc2lvbi5cbiAqL1xuZnVuY3Rpb24gZmluZFZlcnNpb24ocGFja2FnZU5hbWU6IHN0cmluZywgaG9zdDogVHJlZSk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgY2FuZGlkYXRlID0gYG5vZGVfbW9kdWxlcy8ke3BhY2thZ2VOYW1lfS9wYWNrYWdlLmpzb25gO1xuICBpZiAoaG9zdC5leGlzdHMoY2FuZGlkYXRlKSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoaG9zdC5yZWFkKGNhbmRpZGF0ZSkudG9TdHJpbmcoKSk7XG4gICAgICBpZiAocGFja2FnZUpzb24ubmFtZSA9PT0gcGFja2FnZU5hbWUgJiYgcGFja2FnZUpzb24udmVyc2lvbikge1xuICAgICAgICByZXR1cm4gcGFja2FnZUpzb24udmVyc2lvbjtcbiAgICAgIH1cbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQ2xlYW4gdGhlIHZlcnNpb24gc3RyaW5nIGFuZCByZXR1cm4gdmVyc2lvbiBpbiB0aGUgZm9ybSBcIjEuMi4zXCIuIFJldHVyblxuICogbnVsbCBpZiB2ZXJzaW9uIHN0cmluZyBpcyBpbnZhbGlkLiBUaGlzIGlzIHNpbWlsYXIgdG8gc2VtdmVyLmNsZWFuKCkgYnV0XG4gKiB0YWtlcyBjaGFyYWN0ZXJzIGxpa2UgJ14nIGFuZCAnficgaW50byBhY2NvdW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xlYW4odmVyc2lvbjogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBtYXRjaGVzID0gdmVyc2lvbi5tYXRjaCgvKFxcZCtcXC5cXGQrXFwuXFxkKykvKTtcbiAgcmV0dXJuIG1hdGNoZXMgJiYgbWF0Y2hlcy5wb3AoKSB8fCBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBwcm9qZWN0IGNvbnRhaW5zIHJvdXRpbmcgbW9kdWxlLCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbmZ1bmN0aW9uIGhhc1JvdXRpbmdNb2R1bGUoaG9zdDogVHJlZSkge1xuICBsZXQgaGFzUm91dGluZyA9IGZhbHNlO1xuICBob3N0LnZpc2l0KChmaWxlOiBzdHJpbmcpID0+IHsgaGFzUm91dGluZyA9IGhhc1JvdXRpbmcgfHwgZmlsZS5lbmRzV2l0aCgnLXJvdXRpbmcubW9kdWxlLnRzJyk7IH0pO1xuICByZXR1cm4gaGFzUm91dGluZztcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgcHJvamVjdCB1c2VzIFNBU1Mgc3R5bGVzaGVldHMsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaGFzU2Fzc1N0eWxlc2hlZXQoaG9zdDogVHJlZSkge1xuICBsZXQgaGFzU2FzcyA9IGZhbHNlO1xuICAvLyBUaGUgcHJvcGVyIGV4dGVuc2lvbiBmb3IgU0FTUyBpcyAuc2Nzc1xuICBob3N0LnZpc2l0KChmaWxlOiBzdHJpbmcpID0+IHsgaGFzU2FzcyA9IGhhc1Nhc3MgfHwgZmlsZS5lbmRzV2l0aCgnLnNjc3MnKTsgfSk7XG4gIHJldHVybiBoYXNTYXNzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBCYXplbFdvcmtzcGFjZU9wdGlvbnMpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IG9wdGlvbnMubmFtZSB8fCBnZXRXb3Jrc3BhY2UoaG9zdCkuZGVmYXVsdFByb2plY3Q7XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBwcm92aWRlIGEgbmFtZSBmb3IgQmF6ZWwgd29ya3NwYWNlJyk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUobmFtZSk7XG5cbiAgICAvLyBJZiB0aGUgcHJvamVjdCBhbHJlYWR5IGhhcyBzb21lIGRlcHMgaW5zdGFsbGVkLCBCYXplbCBzaG91bGQgdXNlIGV4aXN0aW5nXG4gICAgLy8gdmVyc2lvbnMuXG4gICAgY29uc3QgZXhpc3RpbmdWZXJzaW9ucyA9IHtcbiAgICAgIEFuZ3VsYXI6IGZpbmRWZXJzaW9uKCdAYW5ndWxhci9jb3JlJywgaG9zdCksXG4gICAgICBSeEpzOiBmaW5kVmVyc2lvbigncnhqcycsIGhvc3QpLFxuICAgIH07XG5cbiAgICBPYmplY3Qua2V5cyhleGlzdGluZ1ZlcnNpb25zKS5mb3JFYWNoKChuYW1lOiAnQW5ndWxhcicgfCAnUnhKcycpID0+IHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBleGlzdGluZ1ZlcnNpb25zW25hbWVdIGFzIHN0cmluZztcbiAgICAgIGlmICh2ZXJzaW9uKSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oYEJhemVsIHdpbGwgcmV1c2UgZXhpc3RpbmcgdmVyc2lvbiBmb3IgJHtuYW1lfTogJHt2ZXJzaW9ufWApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKCFob3N0LmV4aXN0cygneWFybi5sb2NrJykpIHtcbiAgICAgIGhvc3QuY3JlYXRlKCd5YXJuLmxvY2snLCAnJyk7XG4gICAgfVxuXG4gICAgY29uc3Qgd29ya3NwYWNlVmVyc2lvbnMgPSB7XG4gICAgICAnUlVMRVNfTk9ERUpTX1ZFUlNJT04nOiAnMC4xOC42JyxcbiAgICAgICdSVUxFU19OT0RFSlNfU0hBMjU2JzogJzE0MTZkMDM4MjNmZWQ2MjRiNDlhMGFiYmQ5OTc5ZjdjNjNiYmVkZmQzNzg5MGRkZWNlZGQyZmUyNWNjY2ViYzYnLFxuICAgICAgJ0FOR1VMQVJfVkVSU0lPTic6IGV4aXN0aW5nVmVyc2lvbnMuQW5ndWxhciB8fCBjbGVhbihsYXRlc3RWZXJzaW9ucy5Bbmd1bGFyKSxcbiAgICAgICdSWEpTX1ZFUlNJT04nOiBleGlzdGluZ1ZlcnNpb25zLlJ4SnMgfHwgY2xlYW4obGF0ZXN0VmVyc2lvbnMuUnhKcyksXG4gICAgICAvLyBUT0RPKGt5bGlhdSk6IENvbnNpZGVyIG1vdmluZyB0aGlzIHRvIGxhdGVzdC12ZXJzaW9ucy50c1xuICAgICAgJ1JVTEVTX1NBU1NfVkVSU0lPTic6ICcxLjE3LjAnLFxuICAgIH07XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICBuYW1lLFxuICAgICAgICAnZG90JzogJy4nLCAuLi53b3Jrc3BhY2VWZXJzaW9ucyxcbiAgICAgICAgcm91dGluZzogaGFzUm91dGluZ01vZHVsZShob3N0KSxcbiAgICAgICAgc2FzczogaGFzU2Fzc1N0eWxlc2hlZXQoaG9zdCksXG4gICAgICB9KSxcbiAgICBdKSk7XG4gIH07XG59XG4iXX0=