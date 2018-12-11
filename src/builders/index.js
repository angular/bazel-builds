/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Bazel bundle builder
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("angular/packages/bazel/src/builders/index", ["require", "exports", "@angular-devkit/core", "rxjs", "rxjs/operators", "angular/packages/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require("@angular-devkit/core");
    var rxjs_1 = require("rxjs");
    var operators_1 = require("rxjs/operators");
    var bazel_1 = require("angular/packages/bazel/src/builders/bazel");
    var Builder = /** @class */ (function () {
        function Builder(context) {
            this.context = context;
        }
        Builder.prototype.run = function (builderConfig) {
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
        return Builder;
    }());
    exports.Builder = Builder;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7OztJQUdILDZDQUE0RDtJQUM1RCw2QkFBcUM7SUFDckMsNENBQW9EO0lBRXBELG1FQUFvRDtJQUdwRDtRQUNFLGlCQUFvQixPQUF1QjtZQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtRQUFHLENBQUM7UUFFL0MscUJBQUcsR0FBSCxVQUFJLGFBQW9EO1lBQ3RELElBQU0sV0FBVyxHQUFHLG9CQUFhLENBQUMsY0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1RixJQUFNLFdBQVcsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUV0RCxJQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFFcEUsSUFBSSxDQUFDLHlCQUFpQixDQUFDLFVBQVUsRUFBRSxXQUFXLENBQUMsRUFBRTtnQkFDL0MsTUFBTSxJQUFJLEtBQUssQ0FDWCxtQkFBaUIsVUFBVSxpQ0FBOEI7cUJBQ3pELE9BQUksVUFBVSwwQ0FBc0MsQ0FBQSxDQUFDLENBQUM7YUFDM0Q7WUFFRCwrQkFBK0I7WUFDL0IsT0FBTyxnQkFBUSxDQUNKLFdBQVcsRUFBRSxVQUFVLEVBQUUsYUFBYSxDQUFDLE9BQU8sQ0FBQyxZQUFjLEVBQUUsV0FBYSxFQUM1RSxFQUFFLENBQUMsV0FBVyxDQUFDO2lCQUNyQixJQUFJLENBQUMsZUFBRyxDQUFDLGNBQU0sT0FBQSxDQUFDLEVBQUMsT0FBTyxFQUFFLElBQUksRUFBQyxDQUFDLEVBQWpCLENBQWlCLENBQUMsRUFBRSxzQkFBVSxDQUFDLGNBQU0sT0FBQSxTQUFFLENBQUUsRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLENBQUMsRUFBckIsQ0FBcUIsQ0FBQyxDQUFHLENBQUM7UUFDckYsQ0FBQztRQUNILGNBQUM7SUFBRCxDQUFDLEFBckJELElBcUJDO0lBckJZLDBCQUFPIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEJhemVsIGJ1bmRsZSBidWlsZGVyXG4gKi9cblxuaW1wb3J0IHtCdWlsZEV2ZW50LCBCdWlsZGVyIGFzIEJ1aWxkZXJJbnRlcmZhY2UsIEJ1aWxkZXJDb25maWd1cmF0aW9uLCBCdWlsZGVyQ29udGV4dH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge2dldFN5c3RlbVBhdGgsIHJlc29sdmV9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7T2JzZXJ2YWJsZSwgb2YgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7Y2F0Y2hFcnJvciwgbWFwLCB0YXB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcblxuaW1wb3J0IHtjaGVja0luc3RhbGxhdGlvbiwgcnVuQmF6ZWx9IGZyb20gJy4vYmF6ZWwnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZXhwb3J0IGNsYXNzIEJ1aWxkZXIgaW1wbGVtZW50cyBCdWlsZGVySW50ZXJmYWNlPFNjaGVtYT4ge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7fVxuXG4gIHJ1bihidWlsZGVyQ29uZmlnOiBCdWlsZGVyQ29uZmlndXJhdGlvbjxQYXJ0aWFsPFNjaGVtYT4+KTogT2JzZXJ2YWJsZTxCdWlsZEV2ZW50PiB7XG4gICAgY29uc3QgcHJvamVjdFJvb3QgPSBnZXRTeXN0ZW1QYXRoKHJlc29sdmUodGhpcy5jb250ZXh0LndvcmtzcGFjZS5yb290LCBidWlsZGVyQ29uZmlnLnJvb3QpKTtcbiAgICBjb25zdCB0YXJnZXRMYWJlbCA9IGJ1aWxkZXJDb25maWcub3B0aW9ucy50YXJnZXRMYWJlbDtcblxuICAgIGNvbnN0IGV4ZWN1dGFibGUgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnMud2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG5cbiAgICBpZiAoIWNoZWNrSW5zdGFsbGF0aW9uKGV4ZWN1dGFibGUsIHByb2plY3RSb290KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcnVuICR7ZXhlY3V0YWJsZX0uIFBsZWFzZSBtYWtlIHN1cmUgdGhhdCB0aGUgYCArXG4gICAgICAgICAgYFwiJHtleGVjdXRhYmxlfVwiIGNvbW1hbmQgaXMgYXZhaWxhYmxlIGluIHRoZSAkUEFUSC5gKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBTdXBwb3J0IHBhc3NpbmcgZmxhZ3MuXG4gICAgcmV0dXJuIHJ1bkJhemVsKFxuICAgICAgICAgICAgICAgcHJvamVjdFJvb3QsIGV4ZWN1dGFibGUsIGJ1aWxkZXJDb25maWcub3B0aW9ucy5iYXplbENvbW1hbmQgISwgdGFyZ2V0TGFiZWwgISxcbiAgICAgICAgICAgICAgIFtdIC8qIGZsYWdzICovKVxuICAgICAgICAucGlwZShtYXAoKCkgPT4gKHtzdWNjZXNzOiB0cnVlfSkpLCBjYXRjaEVycm9yKCgpID0+IG9mICh7c3VjY2VzczogZmFsc2V9KSksICk7XG4gIH1cbn1cbiJdfQ==