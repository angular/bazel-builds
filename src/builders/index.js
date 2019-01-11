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
                    ("\"" + executable + "\" command is available in the $PATH."));
            }
            // TODO: Support passing flags.
            return bazel_1.runBazel(projectRoot, executable, builderConfig.options.bazelCommand, targetLabel, [] /* flags */)
                .pipe(operators_1.map(function () { return ({ success: true }); }), operators_1.catchError(function () { return rxjs_1.of({ success: false }); }));
        };
        return BazelBuilder;
    }());
    exports.default = BazelBuilder;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7OztJQUdILDZDQUE0RDtJQUM1RCw2QkFBcUM7SUFDckMsNENBQW9EO0lBRXBELDJEQUFvRDtJQUdwRDtRQUNFLHNCQUFvQixPQUF1QjtZQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtRQUFHLENBQUM7UUFFL0MsMEJBQUcsR0FBSCxVQUFJLGFBQW9EO1lBQ3RELElBQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1RixJQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUV0RCxJQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFFcEUsSUFBSSxDQUFDLHlCQUFpQixDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsRUFBRTtnQkFDL0MsTUFBTSxJQUFJLEtBQUssQ0FDWCxtQkFBaUIsVUFBVSxpQ0FBOEI7cUJBQ3pELE9BQUksVUFBVSwwQ0FBc0MsQ0FBQSxDQUFDLENBQUM7YUFDM0Q7WUFFRCwrQkFBK0I7WUFDL0IsT0FBTyxnQkFBUSxDQUNKLFdBQVcsRUFBRSxVQUFVLEVBQUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxZQUFjLEVBQUUsV0FBYSxFQUM1RSxFQUFFLENBQUMsV0FBVyxDQUFDO2lCQUNyQixJQUFJLENBQUMsZUFBRyxDQUFDLGNBQU0sT0FBQSxDQUFDLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDLEVBQWpCLENBQWlCLENBQUMsRUFBRSxzQkFBVSxDQUFDLGNBQU0sT0FBQSxTQUFFLENBQUUsRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBckIsQ0FBcUIsQ0FBQyxDQUFHLENBQUM7UUFDckYsQ0FBQztRQUNILG1CQUFDO0lBQUQsQ0FBQyxBQXJCRCxJQXFCQztJQUVELGtCQUFlLFlBQVksQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBCYXplbCBidWlsZGVyXG4gKi9cblxuaW1wb3J0IHtCdWlsZEV2ZW50LCBCdWlsZGVyLCBCdWlsZGVyQ29uZmlndXJhdGlvbiwgQnVpbGRlckNvbnRleHR9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtnZXRTeXN0ZW1QYXRoLCByZXNvbHZlfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge09ic2VydmFibGUsIG9mIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQge2NhdGNoRXJyb3IsIG1hcCwgdGFwfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5cbmltcG9ydCB7Y2hlY2tJbnN0YWxsYXRpb24sIHJ1bkJhemVsfSBmcm9tICcuL2JhemVsJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbmNsYXNzIEJhemVsQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8U2NoZW1hPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHt9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPFBhcnRpYWw8U2NoZW1hPj4pOiBPYnNlcnZhYmxlPEJ1aWxkRXZlbnQ+IHtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IGdldFN5c3RlbVBhdGgocmVzb2x2ZSh0aGlzLmNvbnRleHQud29ya3NwYWNlLnJvb3QsIGJ1aWxkZXJDb25maWcucm9vdCkpO1xuICAgIGNvbnN0IHRhcmdldExhYmVsID0gYnVpbGRlckNvbmZpZy5vcHRpb25zLnRhcmdldExhYmVsO1xuXG4gICAgY29uc3QgZXhlY3V0YWJsZSA9IGJ1aWxkZXJDb25maWcub3B0aW9ucy53YXRjaCA/ICdpYmF6ZWwnIDogJ2JhemVsJztcblxuICAgIGlmICghY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgcHJvamVjdFJvb3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYENvdWxkIG5vdCBydW4gJHtleGVjdXRhYmxlfS4gUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHRoZSBgICtcbiAgICAgICAgICBgXCIke2V4ZWN1dGFibGV9XCIgY29tbWFuZCBpcyBhdmFpbGFibGUgaW4gdGhlICRQQVRILmApO1xuICAgIH1cblxuICAgIC8vIFRPRE86IFN1cHBvcnQgcGFzc2luZyBmbGFncy5cbiAgICByZXR1cm4gcnVuQmF6ZWwoXG4gICAgICAgICAgICAgICBwcm9qZWN0Um9vdCwgZXhlY3V0YWJsZSwgYnVpbGRlckNvbmZpZy5vcHRpb25zLmJhemVsQ29tbWFuZCAhLCB0YXJnZXRMYWJlbCAhLFxuICAgICAgICAgICAgICAgW10gLyogZmxhZ3MgKi8pXG4gICAgICAgIC5waXBlKG1hcCgoKSA9PiAoe3N1Y2Nlc3M6IHRydWV9KSksIGNhdGNoRXJyb3IoKCkgPT4gb2YgKHtzdWNjZXNzOiBmYWxzZX0pKSwgKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCYXplbEJ1aWxkZXI7XG4iXX0=