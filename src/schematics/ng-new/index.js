/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for ng-new project that builds with Bazel.
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("npm_angular_bazel/src/schematics/ng-new/index", ["require", "exports", "@angular-devkit/schematics", "@schematics/angular/utility/validation"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var schematics_1 = require("@angular-devkit/schematics");
    var validation_1 = require("@schematics/angular/utility/validation");
    function default_1(options) {
        return function (host) {
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                schematics_1.externalSchematic('@schematics/angular', 'ng-new', options),
                schematics_1.schematic('ng-add', options, {
                    scope: options.name,
                }),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7OztJQUVILHlEQUEyRjtJQUMzRixxRUFBMkU7SUFHM0UsbUJBQXdCLE9BQWU7UUFDckMsT0FBTyxVQUFDLElBQVU7WUFDaEIsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRWxDLE9BQU8sa0JBQUssQ0FBQztnQkFDWCw4QkFBaUIsQ0FBQyxxQkFBcUIsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDO2dCQUMzRCxzQkFBUyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUU7b0JBQzNCLEtBQUssRUFBRSxPQUFPLENBQUMsSUFBSTtpQkFDcEIsQ0FBQzthQUNILENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFYRCw0QkFXQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7UnVsZSwgVHJlZSwgY2hhaW4sIGV4dGVybmFsU2NoZW1hdGljLCBzY2hlbWF0aWN9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBleHRlcm5hbFNjaGVtYXRpYygnQHNjaGVtYXRpY3MvYW5ndWxhcicsICduZy1uZXcnLCBvcHRpb25zKSxcbiAgICAgIHNjaGVtYXRpYygnbmctYWRkJywgb3B0aW9ucywge1xuICAgICAgICBzY29wZTogb3B0aW9ucy5uYW1lLFxuICAgICAgfSksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=