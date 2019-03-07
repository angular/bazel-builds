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
                'RULES_NODEJS_VERSION': '0.26.0',
                'RULES_NODEJS_SHA256': '5c86b055c57e15bf32d9009a15bcd6d8e190c41b1ff2fb18037b75e0012e4e7c',
                'RULES_SASS_VERSION': '1.17.2',
                'RULES_SASS_SHA256': 'e5316ee8a09d1cbb732d3938b400836bf94dba91a27476e9e27706c4c0edae1f',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings, name: name, 'dot': '.' }, workspaceVersions, { routing: hasRoutingModule(host), sass: hasSassStylesheet(host) })),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQStHO0lBQy9HLDZEQUFnRTtJQUNoRSxxRUFBMkU7SUFJM0U7Ozs7T0FJRztJQUNILFNBQWdCLEtBQUssQ0FBQyxPQUFlO1FBQ25DLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUNqRCxPQUFPLE9BQU8sSUFBSSxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFIRCxzQkFHQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO1FBQ2xDLElBQUksVUFBVSxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxDQUFDLFVBQUMsSUFBWSxJQUFPLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEcsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxpQkFBaUIsQ0FBQyxJQUFVO1FBQ25DLElBQUksT0FBTyxHQUFHLEtBQUssQ0FBQztRQUNwQix5Q0FBeUM7UUFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFDLElBQVksSUFBTyxPQUFPLEdBQUcsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRSxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUMvRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsMkNBQTJDLENBQUMsQ0FBQzthQUM5RDtZQUNELGdDQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRTFCLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQzthQUM5QjtZQUVELElBQU0saUJBQWlCLEdBQUc7Z0JBQ3hCLHNCQUFzQixFQUFFLFFBQVE7Z0JBQ2hDLHFCQUFxQixFQUFFLGtFQUFrRTtnQkFDekYsb0JBQW9CLEVBQUUsUUFBUTtnQkFDOUIsbUJBQW1CLEVBQUUsa0VBQWtFO2FBQ3hGLENBQUM7WUFFRixPQUFPLHNCQUFTLENBQUMsa0JBQUssQ0FBQyxnQkFBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNyQywyQkFBYyxvQkFDWixLQUFLLEVBQUUsY0FBTyxFQUNkLElBQUksTUFBQSxFQUNKLEtBQUssRUFBRSxHQUFHLElBQUssaUJBQWlCLElBQ2hDLE9BQU8sRUFBRSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsRUFDL0IsSUFBSSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUM3QjthQUNILENBQUMsQ0FBQyxDQUFDO1FBQ04sQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQTdCRCw0QkE2QkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgYmF6ZWwtd29ya3NwYWNlXG4gKi9cblxuaW1wb3J0IHtzdHJpbmdzfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFRyZWUsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgbWVyZ2VXaXRoLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge1NjaGVtYSBhcyBCYXplbFdvcmtzcGFjZU9wdGlvbnN9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBDbGVhbiB0aGUgdmVyc2lvbiBzdHJpbmcgYW5kIHJldHVybiB2ZXJzaW9uIGluIHRoZSBmb3JtIFwiMS4yLjNcIi4gUmV0dXJuXG4gKiBudWxsIGlmIHZlcnNpb24gc3RyaW5nIGlzIGludmFsaWQuIFRoaXMgaXMgc2ltaWxhciB0byBzZW12ZXIuY2xlYW4oKSBidXRcbiAqIHRha2VzIGNoYXJhY3RlcnMgbGlrZSAnXicgYW5kICd+JyBpbnRvIGFjY291bnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhbih2ZXJzaW9uOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IG1hdGNoZXMgPSB2ZXJzaW9uLm1hdGNoKC8oXFxkK1xcLlxcZCtcXC5cXGQrKS8pO1xuICByZXR1cm4gbWF0Y2hlcyAmJiBtYXRjaGVzLnBvcCgpIHx8IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHByb2plY3QgY29udGFpbnMgcm91dGluZyBtb2R1bGUsIGZhbHNlIG90aGVyd2lzZS5cbiAqL1xuZnVuY3Rpb24gaGFzUm91dGluZ01vZHVsZShob3N0OiBUcmVlKSB7XG4gIGxldCBoYXNSb3V0aW5nID0gZmFsc2U7XG4gIGhvc3QudmlzaXQoKGZpbGU6IHN0cmluZykgPT4geyBoYXNSb3V0aW5nID0gaGFzUm91dGluZyB8fCBmaWxlLmVuZHNXaXRoKCctcm91dGluZy5tb2R1bGUudHMnKTsgfSk7XG4gIHJldHVybiBoYXNSb3V0aW5nO1xufVxuXG4vKipcbiAqIFJldHVybnMgdHJ1ZSBpZiBwcm9qZWN0IHVzZXMgU0FTUyBzdHlsZXNoZWV0cywgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBoYXNTYXNzU3R5bGVzaGVldChob3N0OiBUcmVlKSB7XG4gIGxldCBoYXNTYXNzID0gZmFsc2U7XG4gIC8vIFRoZSBwcm9wZXIgZXh0ZW5zaW9uIGZvciBTQVNTIGlzIC5zY3NzXG4gIGhvc3QudmlzaXQoKGZpbGU6IHN0cmluZykgPT4geyBoYXNTYXNzID0gaGFzU2FzcyB8fCBmaWxlLmVuZHNXaXRoKCcuc2NzcycpOyB9KTtcbiAgcmV0dXJuIGhhc1Nhc3M7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IEJhemVsV29ya3NwYWNlT3B0aW9ucyk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBuYW1lID0gb3B0aW9ucy5uYW1lIHx8IGdldFdvcmtzcGFjZShob3N0KS5kZWZhdWx0UHJvamVjdDtcbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHByb3ZpZGUgYSBuYW1lIGZvciBCYXplbCB3b3Jrc3BhY2UnKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShuYW1lKTtcblxuICAgIGlmICghaG9zdC5leGlzdHMoJ3lhcm4ubG9jaycpKSB7XG4gICAgICBob3N0LmNyZWF0ZSgneWFybi5sb2NrJywgJycpO1xuICAgIH1cblxuICAgIGNvbnN0IHdvcmtzcGFjZVZlcnNpb25zID0ge1xuICAgICAgJ1JVTEVTX05PREVKU19WRVJTSU9OJzogJzAuMjYuMCcsXG4gICAgICAnUlVMRVNfTk9ERUpTX1NIQTI1Nic6ICc1Yzg2YjA1NWM1N2UxNWJmMzJkOTAwOWExNWJjZDZkOGUxOTBjNDFiMWZmMmZiMTgwMzdiNzVlMDAxMmU0ZTdjJyxcbiAgICAgICdSVUxFU19TQVNTX1ZFUlNJT04nOiAnMS4xNy4yJyxcbiAgICAgICdSVUxFU19TQVNTX1NIQTI1Nic6ICdlNTMxNmVlOGEwOWQxY2JiNzMyZDM5MzhiNDAwODM2YmY5NGRiYTkxYTI3NDc2ZTllMjc3MDZjNGMwZWRhZTFmJyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe1xuICAgICAgICB1dGlsczogc3RyaW5ncyxcbiAgICAgICAgbmFtZSxcbiAgICAgICAgJ2RvdCc6ICcuJywgLi4ud29ya3NwYWNlVmVyc2lvbnMsXG4gICAgICAgIHJvdXRpbmc6IGhhc1JvdXRpbmdNb2R1bGUoaG9zdCksXG4gICAgICAgIHNhc3M6IGhhc1Nhc3NTdHlsZXNoZWV0KGhvc3QpLFxuICAgICAgfSksXG4gICAgXSkpO1xuICB9O1xufVxuIl19