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
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "@angular-devkit/architect", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var architect_1 = require("@angular-devkit/architect");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    function _bazelBuilder(options, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var logger, workspaceRoot, bazelCommand, leaveBazelFilesOnDisk, targetLabel, watch, executable, binary, templateDir, bazelFiles, flags, err_1;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        logger = context.logger, workspaceRoot = context.workspaceRoot;
                        bazelCommand = options.bazelCommand, leaveBazelFilesOnDisk = options.leaveBazelFilesOnDisk, targetLabel = options.targetLabel, watch = options.watch;
                        executable = watch ? 'ibazel' : 'bazel';
                        binary = bazel_1.checkInstallation(executable, workspaceRoot);
                        templateDir = bazel_1.getTemplateDir(workspaceRoot);
                        bazelFiles = bazel_1.copyBazelFiles(workspaceRoot, templateDir);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        flags = [];
                        return [4 /*yield*/, bazel_1.runBazel(workspaceRoot, binary, bazelCommand, targetLabel, flags)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { success: true }];
                    case 3:
                        err_1 = _a.sent();
                        logger.error(err_1.message);
                        return [2 /*return*/, { success: false }];
                    case 4:
                        if (!leaveBazelFilesOnDisk) {
                            bazel_1.deleteBazelFiles(bazelFiles); // this will never throw
                        }
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    exports.default = architect_1.createBuilder(_bazelBuilder);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx1REFBd0Y7SUFFeEYsMkRBQXNHO0lBR3RHLFNBQWUsYUFBYSxDQUFDLE9BQTRCLEVBQUUsT0FBdUI7Ozs7Ozt3QkFFckUsTUFBTSxHQUFtQixPQUFPLE9BQTFCLEVBQUUsYUFBYSxHQUFJLE9BQU8sY0FBWCxDQUFZO3dCQUNqQyxZQUFZLEdBQStDLE9BQU8sYUFBdEQsRUFBRSxxQkFBcUIsR0FBd0IsT0FBTyxzQkFBL0IsRUFBRSxXQUFXLEdBQVcsT0FBTyxZQUFsQixFQUFFLEtBQUssR0FBSSxPQUFPLE1BQVgsQ0FBWTt3QkFDcEUsVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7d0JBQ3hDLE1BQU0sR0FBRyx5QkFBaUIsQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLENBQUM7d0JBQ3RELFdBQVcsR0FBRyxzQkFBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDO3dCQUM1QyxVQUFVLEdBQUcsc0JBQWMsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7Ozs7d0JBR3RELEtBQUssR0FBYSxFQUFFLENBQUM7d0JBQzNCLHFCQUFNLGdCQUFRLENBQUMsYUFBYSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLEtBQUssQ0FBQyxFQUFBOzt3QkFBdkUsU0FBdUUsQ0FBQzt3QkFDeEUsc0JBQU8sRUFBQyxPQUFPLEVBQUUsSUFBSSxFQUFDLEVBQUM7Ozt3QkFFdkIsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7d0JBQzFCLHNCQUFPLEVBQUMsT0FBTyxFQUFFLEtBQUssRUFBQyxFQUFDOzt3QkFFeEIsSUFBSSxDQUFDLHFCQUFxQixFQUFFOzRCQUMxQix3QkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFFLHdCQUF3Qjt5QkFDeEQ7Ozs7OztLQUVKO0lBRUwsa0JBQWUseUJBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBCYXplbCBidWlsZGVyXG4gKi9cblxuaW1wb3J0IHtCdWlsZGVyQ29udGV4dCwgQnVpbGRlck91dHB1dCwgY3JlYXRlQnVpbGRlcix9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHtKc29uT2JqZWN0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge2NoZWNrSW5zdGFsbGF0aW9uLCBjb3B5QmF6ZWxGaWxlcywgZGVsZXRlQmF6ZWxGaWxlcywgZ2V0VGVtcGxhdGVEaXIsIHJ1bkJhemVsfSBmcm9tICcuL2JhemVsJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbmFzeW5jIGZ1bmN0aW9uIF9iYXplbEJ1aWxkZXIob3B0aW9uczogSnNvbk9iamVjdCAmIFNjaGVtYSwgY29udGV4dDogQnVpbGRlckNvbnRleHQsICk6XG4gICAgUHJvbWlzZTxCdWlsZGVyT3V0cHV0PiB7XG4gICAgICBjb25zdCB7bG9nZ2VyLCB3b3Jrc3BhY2VSb290fSA9IGNvbnRleHQ7XG4gICAgICBjb25zdCB7YmF6ZWxDb21tYW5kLCBsZWF2ZUJhemVsRmlsZXNPbkRpc2ssIHRhcmdldExhYmVsLCB3YXRjaH0gPSBvcHRpb25zO1xuICAgICAgY29uc3QgZXhlY3V0YWJsZSA9IHdhdGNoID8gJ2liYXplbCcgOiAnYmF6ZWwnO1xuICAgICAgY29uc3QgYmluYXJ5ID0gY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgd29ya3NwYWNlUm9vdCk7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURpciA9IGdldFRlbXBsYXRlRGlyKHdvcmtzcGFjZVJvb3QpO1xuICAgICAgY29uc3QgYmF6ZWxGaWxlcyA9IGNvcHlCYXplbEZpbGVzKHdvcmtzcGFjZVJvb3QsIHRlbXBsYXRlRGlyKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZmxhZ3M6IHN0cmluZ1tdID0gW107XG4gICAgICAgIGF3YWl0IHJ1bkJhemVsKHdvcmtzcGFjZVJvb3QsIGJpbmFyeSwgYmF6ZWxDb21tYW5kLCB0YXJnZXRMYWJlbCwgZmxhZ3MpO1xuICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IHRydWV9O1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihlcnIubWVzc2FnZSk7XG4gICAgICAgIHJldHVybiB7c3VjY2VzczogZmFsc2V9O1xuICAgICAgfSBmaW5hbGx5IHtcbiAgICAgICAgaWYgKCFsZWF2ZUJhemVsRmlsZXNPbkRpc2spIHtcbiAgICAgICAgICBkZWxldGVCYXplbEZpbGVzKGJhemVsRmlsZXMpOyAgLy8gdGhpcyB3aWxsIG5ldmVyIHRocm93XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2JhemVsQnVpbGRlcik7XG4iXX0=