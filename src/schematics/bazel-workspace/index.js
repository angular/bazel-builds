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
            var workspaceVersions = {
                'RULES_NODEJS_VERSION': '0.16.8',
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
                'RXJS_VERSION': existingVersions.RxJs || clean(latest_versions_1.latestVersions.RxJs),
                // TODO(kyliau): Consider moving this to latest-versions.ts
                'RULES_SASS_VERSION': '1.15.1',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings, name: name, 'dot': '.' }, workspaceVersions, { routing: hasRoutingModule(host), sass: hasSassStylesheet(host) })),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsSUFBVTtRQUNsRCxJQUFNLFNBQVMsR0FBRyxrQkFBZ0IsV0FBVyxrQkFBZSxDQUFDO1FBQzdELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMxQixJQUFJO2dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7b0JBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQztpQkFDNUI7YUFDRjtZQUFDLFdBQU07YUFDUDtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFNBQWdCLEtBQUssQ0FBQyxPQUFlO1FBQ25DLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRCxPQUFPLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFIRCxzQkFHQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO1FBQ2xDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsSUFBWSxJQUFPLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEcsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLElBQVksSUFBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUMvRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQzthQUM5RDtZQUNELGdDQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFCLDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBRztnQkFDdkIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDO2dCQUMzQyxJQUFJLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7YUFDaEMsQ0FBQztZQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUF3QjtnQkFDN0QsSUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFXLENBQUM7Z0JBQ2pELElBQUksT0FBTyxFQUFFO29CQUNYLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLDJDQUF5QyxJQUFJLFVBQUssT0FBUyxDQUFDLENBQUM7aUJBQ2xGO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFNLGlCQUFpQixHQUFHO2dCQUN4QixzQkFBc0IsRUFBRSxRQUFRO2dCQUNoQyxpQkFBaUIsRUFBRSxnQkFBZ0IsQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLGdDQUFjLENBQUMsT0FBTyxDQUFDO2dCQUM1RSxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxnQ0FBYyxDQUFDLElBQUksQ0FBQztnQkFDbkUsMkRBQTJEO2dCQUMzRCxvQkFBb0IsRUFBRSxRQUFRO2FBQy9CLENBQUM7WUFFRixPQUFPLHNCQUFTLENBQUMsa0JBQUssQ0FBQyxnQkFBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNyQywyQkFBYyxvQkFDWixLQUFLLEVBQUUsY0FBTyxFQUNkLElBQUksTUFBQSxFQUNKLEtBQUssRUFBRSxHQUFHLElBQUssaUJBQWlCLElBQ2hDLE9BQU8sRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFDL0IsSUFBSSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUM3QjthQUNILENBQUMsQ0FBQyxDQUFDO1FBQ04sQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQXhDRCw0QkF3Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgYmF6ZWwtd29ya3NwYWNlXG4gKi9cblxuaW1wb3J0IHtzdHJpbmdzfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFRyZWUsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgbWVyZ2VXaXRoLCBtb3ZlLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7bGF0ZXN0VmVyc2lvbnN9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9sYXRlc3QtdmVyc2lvbnMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7U2NoZW1hIGFzIEJhemVsV29ya3NwYWNlT3B0aW9uc30gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbi8qKlxuICogTG9vayBmb3IgcGFja2FnZS5qc29uIGZpbGUgZm9yIHBhY2thZ2Ugd2l0aCBgcGFja2FnZU5hbWVgIGluIG5vZGVfbW9kdWxlcyBhbmRcbiAqIGV4dHJhY3QgaXRzIHZlcnNpb24uXG4gKi9cbmZ1bmN0aW9uIGZpbmRWZXJzaW9uKHBhY2thZ2VOYW1lOiBzdHJpbmcsIGhvc3Q6IFRyZWUpOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IGNhbmRpZGF0ZSA9IGBub2RlX21vZHVsZXMvJHtwYWNrYWdlTmFtZX0vcGFja2FnZS5qc29uYDtcbiAgaWYgKGhvc3QuZXhpc3RzKGNhbmRpZGF0ZSkpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKGhvc3QucmVhZChjYW5kaWRhdGUpLnRvU3RyaW5nKCkpO1xuICAgICAgaWYgKHBhY2thZ2VKc29uLm5hbWUgPT09IHBhY2thZ2VOYW1lICYmIHBhY2thZ2VKc29uLnZlcnNpb24pIHtcbiAgICAgICAgcmV0dXJuIHBhY2thZ2VKc29uLnZlcnNpb247XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENsZWFuIHRoZSB2ZXJzaW9uIHN0cmluZyBhbmQgcmV0dXJuIHZlcnNpb24gaW4gdGhlIGZvcm0gXCIxLjIuM1wiLiBSZXR1cm5cbiAqIG51bGwgaWYgdmVyc2lvbiBzdHJpbmcgaXMgaW52YWxpZC4gVGhpcyBpcyBzaW1pbGFyIHRvIHNlbXZlci5jbGVhbigpIGJ1dFxuICogdGFrZXMgY2hhcmFjdGVycyBsaWtlICdeJyBhbmQgJ34nIGludG8gYWNjb3VudC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFuKHZlcnNpb246IHN0cmluZyk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHZlcnNpb24ubWF0Y2goLyhcXGQrXFwuXFxkK1xcLlxcZCspLyk7XG4gIHJldHVybiBtYXRjaGVzICYmIG1hdGNoZXMucG9wKCkgfHwgbnVsbDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgcHJvamVjdCBjb250YWlucyByb3V0aW5nIG1vZHVsZSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBoYXNSb3V0aW5nTW9kdWxlKGhvc3Q6IFRyZWUpIHtcbiAgbGV0IGhhc1JvdXRpbmcgPSBmYWxzZTtcbiAgaG9zdC52aXNpdCgoZmlsZTogc3RyaW5nKSA9PiB7IGhhc1JvdXRpbmcgPSBoYXNSb3V0aW5nIHx8IGZpbGUuZW5kc1dpdGgoJy1yb3V0aW5nLm1vZHVsZS50cycpOyB9KTtcbiAgcmV0dXJuIGhhc1JvdXRpbmc7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHByb2plY3QgdXNlcyBTQVNTIHN0eWxlc2hlZXRzLCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbmZ1bmN0aW9uIGhhc1Nhc3NTdHlsZXNoZWV0KGhvc3Q6IFRyZWUpIHtcbiAgbGV0IGhhc1Nhc3MgPSBmYWxzZTtcbiAgLy8gVGhlIHByb3BlciBleHRlbnNpb24gZm9yIFNBU1MgaXMgLnNjc3NcbiAgaG9zdC52aXNpdCgoZmlsZTogc3RyaW5nKSA9PiB7IGhhc1Nhc3MgPSBoYXNTYXNzIHx8IGZpbGUuZW5kc1dpdGgoJy5zY3NzJyk7IH0pO1xuICByZXR1cm4gaGFzU2Fzcztcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogQmF6ZWxXb3Jrc3BhY2VPcHRpb25zKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBvcHRpb25zLm5hbWUgfHwgZ2V0V29ya3NwYWNlKGhvc3QpLmRlZmF1bHRQcm9qZWN0O1xuICAgIGlmICghbmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2UgcHJvdmlkZSBhIG5hbWUgZm9yIEJhemVsIHdvcmtzcGFjZScpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG5hbWUpO1xuXG4gICAgLy8gSWYgdGhlIHByb2plY3QgYWxyZWFkeSBoYXMgc29tZSBkZXBzIGluc3RhbGxlZCwgQmF6ZWwgc2hvdWxkIHVzZSBleGlzdGluZ1xuICAgIC8vIHZlcnNpb25zLlxuICAgIGNvbnN0IGV4aXN0aW5nVmVyc2lvbnMgPSB7XG4gICAgICBBbmd1bGFyOiBmaW5kVmVyc2lvbignQGFuZ3VsYXIvY29yZScsIGhvc3QpLFxuICAgICAgUnhKczogZmluZFZlcnNpb24oJ3J4anMnLCBob3N0KSxcbiAgICB9O1xuXG4gICAgT2JqZWN0LmtleXMoZXhpc3RpbmdWZXJzaW9ucykuZm9yRWFjaCgobmFtZTogJ0FuZ3VsYXInIHwgJ1J4SnMnKSA9PiB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gZXhpc3RpbmdWZXJzaW9uc1tuYW1lXSBhcyBzdHJpbmc7XG4gICAgICBpZiAodmVyc2lvbikge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKGBCYXplbCB3aWxsIHJldXNlIGV4aXN0aW5nIHZlcnNpb24gZm9yICR7bmFtZX06ICR7dmVyc2lvbn1gKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHdvcmtzcGFjZVZlcnNpb25zID0ge1xuICAgICAgJ1JVTEVTX05PREVKU19WRVJTSU9OJzogJzAuMTYuOCcsXG4gICAgICAnQU5HVUxBUl9WRVJTSU9OJzogZXhpc3RpbmdWZXJzaW9ucy5Bbmd1bGFyIHx8IGNsZWFuKGxhdGVzdFZlcnNpb25zLkFuZ3VsYXIpLFxuICAgICAgJ1JYSlNfVkVSU0lPTic6IGV4aXN0aW5nVmVyc2lvbnMuUnhKcyB8fCBjbGVhbihsYXRlc3RWZXJzaW9ucy5SeEpzKSxcbiAgICAgIC8vIFRPRE8oa3lsaWF1KTogQ29uc2lkZXIgbW92aW5nIHRoaXMgdG8gbGF0ZXN0LXZlcnNpb25zLnRzXG4gICAgICAnUlVMRVNfU0FTU19WRVJTSU9OJzogJzEuMTUuMScsXG4gICAgfTtcblxuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHtcbiAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgIG5hbWUsXG4gICAgICAgICdkb3QnOiAnLicsIC4uLndvcmtzcGFjZVZlcnNpb25zLFxuICAgICAgICByb3V0aW5nOiBoYXNSb3V0aW5nTW9kdWxlKGhvc3QpLFxuICAgICAgICBzYXNzOiBoYXNTYXNzU3R5bGVzaGVldChob3N0KSxcbiAgICAgIH0pLFxuICAgIF0pKTtcbiAgfTtcbn1cbiJdfQ==