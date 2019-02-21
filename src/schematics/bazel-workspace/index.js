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
                'RULES_NODEJS_VERSION': '0.18.6',
                'RULES_NODEJS_SHA256': '1416d03823fed624b49a0abbd9979f7c63bbedfd37890ddecedd2fe25cccebc6',
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsSUFBVTtRQUNsRCxJQUFNLFNBQVMsR0FBRyxrQkFBZ0IsV0FBVyxrQkFBZSxDQUFDO1FBQzdELElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUMxQixJQUFJO2dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7b0JBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQztpQkFDNUI7YUFDRjtZQUFDLFdBQU07YUFDUDtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILFNBQWdCLEtBQUssQ0FBQyxPQUFlO1FBQ25DLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRCxPQUFPLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFIRCxzQkFHQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO1FBQ2xDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsSUFBWSxJQUFPLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEcsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLElBQVksSUFBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUMvRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQzthQUM5RDtZQUNELGdDQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFCLDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBRztnQkFDdkIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDO2dCQUMzQyxJQUFJLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUM7YUFDaEMsQ0FBQztZQUVGLE1BQU0sQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxJQUF3QjtnQkFDN0QsSUFBTSxPQUFPLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxDQUFXLENBQUM7Z0JBQ2pELElBQUksT0FBTyxFQUFFO29CQUNYLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLDJDQUF5QyxJQUFJLFVBQUssT0FBUyxDQUFDLENBQUM7aUJBQ2xGO1lBQ0gsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFNLGlCQUFpQixHQUFHO2dCQUN4QixzQkFBc0IsRUFBRSxRQUFRO2dCQUNoQyxxQkFBcUIsRUFBRSxrRUFBa0U7Z0JBQ3pGLGlCQUFpQixFQUFFLGdCQUFnQixDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsZ0NBQWMsQ0FBQyxPQUFPLENBQUM7Z0JBQzVFLDJEQUEyRDtnQkFDM0Qsb0JBQW9CLEVBQUUsUUFBUTthQUMvQixDQUFDO1lBRUYsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsb0JBQ1osS0FBSyxFQUFFLGNBQU8sRUFDZCxJQUFJLE1BQUEsRUFDSixLQUFLLEVBQUUsR0FBRyxJQUFLLGlCQUFpQixJQUNoQyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQy9CLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFDN0I7YUFDSCxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQztJQUNKLENBQUM7SUF4Q0QsNEJBd0NDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIGJhemVsLXdvcmtzcGFjZVxuICovXG5cbmltcG9ydCB7c3RyaW5nc30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIG1lcmdlV2l0aCwgbW92ZSwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge2xhdGVzdFZlcnNpb25zfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvbGF0ZXN0LXZlcnNpb25zJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge1NjaGVtYSBhcyBCYXplbFdvcmtzcGFjZU9wdGlvbnN9IGZyb20gJy4vc2NoZW1hJztcblxuXG4vKipcbiAqIExvb2sgZm9yIHBhY2thZ2UuanNvbiBmaWxlIGZvciBwYWNrYWdlIHdpdGggYHBhY2thZ2VOYW1lYCBpbiBub2RlX21vZHVsZXMgYW5kXG4gKiBleHRyYWN0IGl0cyB2ZXJzaW9uLlxuICovXG5mdW5jdGlvbiBmaW5kVmVyc2lvbihwYWNrYWdlTmFtZTogc3RyaW5nLCBob3N0OiBUcmVlKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBjYW5kaWRhdGUgPSBgbm9kZV9tb2R1bGVzLyR7cGFja2FnZU5hbWV9L3BhY2thZ2UuanNvbmA7XG4gIGlmIChob3N0LmV4aXN0cyhjYW5kaWRhdGUpKSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHBhY2thZ2VKc29uID0gSlNPTi5wYXJzZShob3N0LnJlYWQoY2FuZGlkYXRlKS50b1N0cmluZygpKTtcbiAgICAgIGlmIChwYWNrYWdlSnNvbi5uYW1lID09PSBwYWNrYWdlTmFtZSAmJiBwYWNrYWdlSnNvbi52ZXJzaW9uKSB7XG4gICAgICAgIHJldHVybiBwYWNrYWdlSnNvbi52ZXJzaW9uO1xuICAgICAgfVxuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBDbGVhbiB0aGUgdmVyc2lvbiBzdHJpbmcgYW5kIHJldHVybiB2ZXJzaW9uIGluIHRoZSBmb3JtIFwiMS4yLjNcIi4gUmV0dXJuXG4gKiBudWxsIGlmIHZlcnNpb24gc3RyaW5nIGlzIGludmFsaWQuIFRoaXMgaXMgc2ltaWxhciB0byBzZW12ZXIuY2xlYW4oKSBidXRcbiAqIHRha2VzIGNoYXJhY3RlcnMgbGlrZSAnXicgYW5kICd+JyBpbnRvIGFjY291bnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhbih2ZXJzaW9uOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IG1hdGNoZXMgPSB2ZXJzaW9uLm1hdGNoKC8oXFxkK1xcLlxcZCtcXC5cXGQrKS8pO1xuICByZXR1cm4gbWF0Y2hlcyAmJiBtYXRjaGVzLnBvcCgpIHx8IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHByb2plY3QgY29udGFpbnMgcm91dGluZyBtb2R1bGUsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaGFzUm91dGluZ01vZHVsZShob3N0OiBUcmVlKSB7XG4gIGxldCBoYXNSb3V0aW5nID0gZmFsc2U7XG4gIGhvc3QudmlzaXQoKGZpbGU6IHN0cmluZykgPT4geyBoYXNSb3V0aW5nID0gaGFzUm91dGluZyB8fCBmaWxlLmVuZHNXaXRoKCctcm91dGluZy5tb2R1bGUudHMnKTsgfSk7XG4gIHJldHVybiBoYXNSb3V0aW5nO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBwcm9qZWN0IHVzZXMgU0FTUyBzdHlsZXNoZWV0cywgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBoYXNTYXNzU3R5bGVzaGVldChob3N0OiBUcmVlKSB7XG4gIGxldCBoYXNTYXNzID0gZmFsc2U7XG4gIC8vIFRoZSBwcm9wZXIgZXh0ZW5zaW9uIGZvciBTQVNTIGlzIC5zY3NzXG4gIGhvc3QudmlzaXQoKGZpbGU6IHN0cmluZykgPT4geyBoYXNTYXNzID0gaGFzU2FzcyB8fCBmaWxlLmVuZHNXaXRoKCcuc2NzcycpOyB9KTtcbiAgcmV0dXJuIGhhc1Nhc3M7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IEJhemVsV29ya3NwYWNlT3B0aW9ucyk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBuYW1lID0gb3B0aW9ucy5uYW1lIHx8IGdldFdvcmtzcGFjZShob3N0KS5kZWZhdWx0UHJvamVjdDtcbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHByb3ZpZGUgYSBuYW1lIGZvciBCYXplbCB3b3Jrc3BhY2UnKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShuYW1lKTtcblxuICAgIC8vIElmIHRoZSBwcm9qZWN0IGFscmVhZHkgaGFzIHNvbWUgZGVwcyBpbnN0YWxsZWQsIEJhemVsIHNob3VsZCB1c2UgZXhpc3RpbmdcbiAgICAvLyB2ZXJzaW9ucy5cbiAgICBjb25zdCBleGlzdGluZ1ZlcnNpb25zID0ge1xuICAgICAgQW5ndWxhcjogZmluZFZlcnNpb24oJ0Bhbmd1bGFyL2NvcmUnLCBob3N0KSxcbiAgICAgIFJ4SnM6IGZpbmRWZXJzaW9uKCdyeGpzJywgaG9zdCksXG4gICAgfTtcblxuICAgIE9iamVjdC5rZXlzKGV4aXN0aW5nVmVyc2lvbnMpLmZvckVhY2goKG5hbWU6ICdBbmd1bGFyJyB8ICdSeEpzJykgPT4ge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGV4aXN0aW5nVmVyc2lvbnNbbmFtZV0gYXMgc3RyaW5nO1xuICAgICAgaWYgKHZlcnNpb24pIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhgQmF6ZWwgd2lsbCByZXVzZSBleGlzdGluZyB2ZXJzaW9uIGZvciAke25hbWV9OiAke3ZlcnNpb259YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VWZXJzaW9ucyA9IHtcbiAgICAgICdSVUxFU19OT0RFSlNfVkVSU0lPTic6ICcwLjE4LjYnLFxuICAgICAgJ1JVTEVTX05PREVKU19TSEEyNTYnOiAnMTQxNmQwMzgyM2ZlZDYyNGI0OWEwYWJiZDk5NzlmN2M2M2JiZWRmZDM3ODkwZGRlY2VkZDJmZTI1Y2NjZWJjNicsXG4gICAgICAnQU5HVUxBUl9WRVJTSU9OJzogZXhpc3RpbmdWZXJzaW9ucy5Bbmd1bGFyIHx8IGNsZWFuKGxhdGVzdFZlcnNpb25zLkFuZ3VsYXIpLFxuICAgICAgLy8gVE9ETyhreWxpYXUpOiBDb25zaWRlciBtb3ZpbmcgdGhpcyB0byBsYXRlc3QtdmVyc2lvbnMudHNcbiAgICAgICdSVUxFU19TQVNTX1ZFUlNJT04nOiAnMS4xNS4xJyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe1xuICAgICAgICB1dGlsczogc3RyaW5ncyxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgJ2RvdCc6ICcuJywgLi4ud29ya3NwYWNlVmVyc2lvbnMsXG4gICAgICAgIHJvdXRpbmc6IGhhc1JvdXRpbmdNb2R1bGUoaG9zdCksXG4gICAgICAgIHNhc3M6IGhhc1Nhc3NTdHlsZXNoZWV0KGhvc3QpLFxuICAgICAgfSksXG4gICAgXSkpO1xuICB9O1xufVxuIl19