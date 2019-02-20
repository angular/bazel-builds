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
        define("npm_angular_bazel/src/schematics/bazel-workspace/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/validation"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var config_1 = require("@schematics/angular/utility/config");
    var validation_1 = require("@schematics/angular/utility/validation");
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
            if (!host.exists('yarn.lock')) {
                host.create('yarn.lock', '');
            }
            var workspaceVersions = {
                'RULES_NODEJS_VERSION': '0.18.6',
                'RULES_NODEJS_SHA256': '1416d03823fed624b49a0abbd9979f7c63bbedfd37890ddecedd2fe25cccebc6',
                'RULES_SASS_VERSION': '1.17.0',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings, name: name, 'dot': '.' }, workspaceVersions, { routing: hasRoutingModule(host), sass: hasSassStylesheet(host) })),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQStHO0lBQy9HLDZEQUFnRTtJQUNoRSxxRUFBMkU7SUFJM0U7Ozs7T0FJRztJQUNILFNBQWdCLEtBQUssQ0FBQyxPQUFlO1FBQ25DLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRCxPQUFPLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFIRCxzQkFHQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO1FBQ2xDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsSUFBWSxJQUFPLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEcsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLElBQVksSUFBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUMvRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQzthQUM5RDtZQUNELGdDQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQzthQUM5QjtZQUVELElBQU0saUJBQWlCLEdBQUc7Z0JBQ3hCLHNCQUFzQixFQUFFLFFBQVE7Z0JBQ2hDLHFCQUFxQixFQUFFLGtFQUFrRTtnQkFDekYsb0JBQW9CLEVBQUUsUUFBUTthQUMvQixDQUFDO1lBRUYsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsb0JBQ1osS0FBSyxFQUFFLGNBQU8sRUFDZCxJQUFJLE1BQUEsRUFDSixLQUFLLEVBQUUsR0FBRyxJQUFLLGlCQUFpQixJQUNoQyxPQUFPLEVBQUUsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQy9CLElBQUksRUFBRSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsSUFDN0I7YUFDSCxDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQztJQUNKLENBQUM7SUE1QkQsNEJBNEJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIGJhemVsLXdvcmtzcGFjZVxuICovXG5cbmltcG9ydCB7c3RyaW5nc30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIG1lcmdlV2l0aCwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtTY2hlbWEgYXMgQmF6ZWxXb3Jrc3BhY2VPcHRpb25zfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogQ2xlYW4gdGhlIHZlcnNpb24gc3RyaW5nIGFuZCByZXR1cm4gdmVyc2lvbiBpbiB0aGUgZm9ybSBcIjEuMi4zXCIuIFJldHVyblxuICogbnVsbCBpZiB2ZXJzaW9uIHN0cmluZyBpcyBpbnZhbGlkLiBUaGlzIGlzIHNpbWlsYXIgdG8gc2VtdmVyLmNsZWFuKCkgYnV0XG4gKiB0YWtlcyBjaGFyYWN0ZXJzIGxpa2UgJ14nIGFuZCAnficgaW50byBhY2NvdW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xlYW4odmVyc2lvbjogc3RyaW5nKTogc3RyaW5nfG51bGwge1xuICBjb25zdCBtYXRjaGVzID0gdmVyc2lvbi5tYXRjaCgvKFxcZCtcXC5cXGQrXFwuXFxkKykvKTtcbiAgcmV0dXJuIG1hdGNoZXMgJiYgbWF0Y2hlcy5wb3AoKSB8fCBudWxsO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBwcm9qZWN0IGNvbnRhaW5zIHJvdXRpbmcgbW9kdWxlLCBmYWxzZSBvdGhlcndpc2UuXG4gKi9cbmZ1bmN0aW9uIGhhc1JvdXRpbmdNb2R1bGUoaG9zdDogVHJlZSkge1xuICBsZXQgaGFzUm91dGluZyA9IGZhbHNlO1xuICBob3N0LnZpc2l0KChmaWxlOiBzdHJpbmcpID0+IHsgaGFzUm91dGluZyA9IGhhc1JvdXRpbmcgfHwgZmlsZS5lbmRzV2l0aCgnLXJvdXRpbmcubW9kdWxlLnRzJyk7IH0pO1xuICByZXR1cm4gaGFzUm91dGluZztcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgcHJvamVjdCB1c2VzIFNBU1Mgc3R5bGVzaGVldHMsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaGFzU2Fzc1N0eWxlc2hlZXQoaG9zdDogVHJlZSkge1xuICBsZXQgaGFzU2FzcyA9IGZhbHNlO1xuICAvLyBUaGUgcHJvcGVyIGV4dGVuc2lvbiBmb3IgU0FTUyBpcyAuc2Nzc1xuICBob3N0LnZpc2l0KChmaWxlOiBzdHJpbmcpID0+IHsgaGFzU2FzcyA9IGhhc1Nhc3MgfHwgZmlsZS5lbmRzV2l0aCgnLnNjc3MnKTsgfSk7XG4gIHJldHVybiBoYXNTYXNzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBCYXplbFdvcmtzcGFjZU9wdGlvbnMpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IG9wdGlvbnMubmFtZSB8fCBnZXRXb3Jrc3BhY2UoaG9zdCkuZGVmYXVsdFByb2plY3Q7XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBwcm92aWRlIGEgbmFtZSBmb3IgQmF6ZWwgd29ya3NwYWNlJyk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUobmFtZSk7XG5cbiAgICBpZiAoIWhvc3QuZXhpc3RzKCd5YXJuLmxvY2snKSkge1xuICAgICAgaG9zdC5jcmVhdGUoJ3lhcm4ubG9jaycsICcnKTtcbiAgICB9XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VWZXJzaW9ucyA9IHtcbiAgICAgICdSVUxFU19OT0RFSlNfVkVSU0lPTic6ICcwLjE4LjYnLFxuICAgICAgJ1JVTEVTX05PREVKU19TSEEyNTYnOiAnMTQxNmQwMzgyM2ZlZDYyNGI0OWEwYWJiZDk5NzlmN2M2M2JiZWRmZDM3ODkwZGRlY2VkZDJmZTI1Y2NjZWJjNicsXG4gICAgICAnUlVMRVNfU0FTU19WRVJTSU9OJzogJzEuMTcuMCcsXG4gICAgfTtcblxuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHtcbiAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgIG5hbWUsXG4gICAgICAgICdkb3QnOiAnLicsIC4uLndvcmtzcGFjZVZlcnNpb25zLFxuICAgICAgICByb3V0aW5nOiBoYXNSb3V0aW5nTW9kdWxlKGhvc3QpLFxuICAgICAgICBzYXNzOiBoYXNTYXNzU3R5bGVzaGVldChob3N0KSxcbiAgICAgIH0pLFxuICAgIF0pKTtcbiAgfTtcbn1cbiJdfQ==