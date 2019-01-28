/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel builder
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/bazel/src/builders", ["require", "exports", "@angular-devkit/core", "rxjs", "rxjs/operators", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require("@angular-devkit/core");
    var rxjs_1 = require("rxjs");
    var operators_1 = require("rxjs/operators");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    var BazelBuilder = /** @class */ (function () {
        function BazelBuilder(context) {
            this.context = context;
        }
        BazelBuilder.prototype.run = function (builderConfig) {
            var projectRoot = core_1.getSystemPath(core_1.resolve(this.context.workspace.root, builderConfig.root));
            var targetLabel = builderConfig.options.targetLabel;
            var executable = builderConfig.options.watch ? 'ibazel' : 'bazel';
            if (!bazel_1.checkInstallation(executable, projectRoot)) {
                throw new Error("Could not run " + executable + ". Please make sure that the " +
                    ("\"" + executable + "\" command is installed by running ") +
                    "\"npm install\" or \"yarn install\".");
            }
            // TODO: Support passing flags.
            return bazel_1.runBazel(projectRoot, executable, builderConfig.options.bazelCommand, targetLabel, [] /* flags */)
                .pipe(operators_1.map(function () { return ({ success: true }); }), operators_1.catchError(function () { return rxjs_1.of({ success: false }); }));
        };
        return BazelBuilder;
    }());
    exports.default = BazelBuilder;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7OztJQUdILDZDQUE0RDtJQUM1RCw2QkFBcUM7SUFDckMsNENBQStDO0lBRS9DLDJEQUFvRDtJQUdwRDtRQUNFLHNCQUFvQixPQUF1QjtZQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtRQUFHLENBQUM7UUFFL0MsMEJBQUcsR0FBSCxVQUFJLGFBQW9EO1lBQ3RELElBQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1RixJQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUV0RCxJQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFFcEUsSUFBSSxDQUFDLHlCQUFpQixDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsRUFBRTtnQkFDL0MsTUFBTSxJQUFJLEtBQUssQ0FDWCxtQkFBaUIsVUFBVSxpQ0FBOEI7cUJBQ3pELE9BQUksVUFBVSx3Q0FBb0MsQ0FBQTtvQkFDbEQsc0NBQWtDLENBQUMsQ0FBQzthQUN6QztZQUVELCtCQUErQjtZQUMvQixPQUFPLGdCQUFRLENBQ0osV0FBVyxFQUFFLFVBQVUsRUFBRSxhQUFhLENBQUMsT0FBTyxDQUFDLFlBQWMsRUFBRSxXQUFhLEVBQzVFLEVBQUUsQ0FBQyxXQUFXLENBQUM7aUJBQ3JCLElBQUksQ0FBQyxlQUFHLENBQUMsY0FBTSxPQUFBLENBQUMsRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxFQUFFLHNCQUFVLENBQUMsY0FBTSxPQUFBLFNBQUUsQ0FBRSxFQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUMsQ0FBQyxFQUFyQixDQUFxQixDQUFDLENBQUcsQ0FBQztRQUNyRixDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBdEJELElBc0JDO0lBRUQsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEJhemVsIGJ1aWxkZXJcbiAqL1xuXG5pbXBvcnQge0J1aWxkRXZlbnQsIEJ1aWxkZXIsIEJ1aWxkZXJDb25maWd1cmF0aW9uLCBCdWlsZGVyQ29udGV4dH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge2dldFN5c3RlbVBhdGgsIHJlc29sdmV9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7T2JzZXJ2YWJsZSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7Y2F0Y2hFcnJvciwgbWFwfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7Y2hlY2tJbnN0YWxsYXRpb24sIHJ1bkJhemVsfSBmcm9tICcuL2JhemVsJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbmNsYXNzIEJhemVsQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8U2NoZW1hPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHt9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPFBhcnRpYWw8U2NoZW1hPj4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZSh0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCkpO1xuICAgIGNvbnN0IHRhcmdldExhYmVsID0gYnVpbGRlckNvbmZpZy5vcHRpb25zLnRhcmdldExhYmVsO1xuXG4gICAgY29uc3QgZXhlY3V0YWJsZSA9IGJ1aWxkZXJDb25maWcub3B0aW9ucy53YXRjaCA/ICdpYmF6ZWwnIDogJ2JhemVsJztcblxuICAgIGlmICghY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgcHJvamVjdFJvb3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENvdWxkIG5vdCBydW4gJHtleGVjdXRhYmxlfS4gUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHRoZSBgICtcbiAgICAgICAgICBgXCIke2V4ZWN1dGFibGV9XCIgY29tbWFuZCBpcyBpbnN0YWxsZWQgYnkgcnVubmluZyBgICtcbiAgICAgICAgICBgXCJucG0gaW5zdGFsbFwiIG9yIFwieWFybiBpbnN0YWxsXCIuYCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogU3VwcG9ydCBwYXNzaW5nIGZsYWdzLlxuICAgIHJldHVybiBydW5CYXplbChcbiAgICAgICAgICAgICAgIHByb2plY3RSb290LCBleGVjdXRhYmxlLCBidWlsZGVyQ29uZmlnLm9wdGlvbnMuYmF6ZWxDb21tYW5kICEsIHRhcmdldExhYmVsICEsXG4gICAgICAgICAgICAgICBbXSAvKiBmbGFncyAqLylcbiAgICAgICAgLnBpcGUobWFwKCgpID0+ICh7c3VjY2VzczogdHJ1ZX0pKSwgY2F0Y2hFcnJvcigoKSA9PiBvZiAoe3N1Y2Nlc3M6IGZhbHNlfSkpLCApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJhemVsQnVpbGRlcjtcbiJdfQ==