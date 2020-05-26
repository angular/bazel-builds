/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx1REFBd0Y7SUFFeEYsMkRBQXNHO0lBR3RHLFNBQWUsYUFBYSxDQUN4QixPQUEwQixFQUMxQixPQUF1Qjs7Ozs7O3dCQUVsQixNQUFNLEdBQW1CLE9BQU8sT0FBMUIsRUFBRSxhQUFhLEdBQUksT0FBTyxjQUFYLENBQVk7d0JBQ2pDLFlBQVksR0FBK0MsT0FBTyxhQUF0RCxFQUFFLHFCQUFxQixHQUF3QixPQUFPLHNCQUEvQixFQUFFLFdBQVcsR0FBVyxPQUFPLFlBQWxCLEVBQUUsS0FBSyxHQUFJLE9BQU8sTUFBWCxDQUFZO3dCQUNwRSxVQUFVLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQzt3QkFDeEMsTUFBTSxHQUFHLHlCQUFpQixDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsQ0FBQzt3QkFDdEQsV0FBVyxHQUFHLHNCQUFjLENBQUMsYUFBYSxDQUFDLENBQUM7d0JBQzVDLFVBQVUsR0FBRyxzQkFBYyxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQzs7Ozt3QkFHdEQsS0FBSyxHQUFhLEVBQUUsQ0FBQzt3QkFDM0IscUJBQU0sZ0JBQVEsQ0FBQyxhQUFhLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUE7O3dCQUF2RSxTQUF1RSxDQUFDO3dCQUN4RSxzQkFBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsRUFBQzs7O3dCQUV2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzt3QkFDMUIsc0JBQU8sRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLEVBQUM7O3dCQUV4QixJQUFJLENBQUMscUJBQXFCLEVBQUU7NEJBQzFCLHdCQUFnQixDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUUsd0JBQXdCO3lCQUN4RDs7Ozs7O0tBRUo7SUFFRCxrQkFBZSx5QkFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgQmF6ZWwgYnVpbGRlclxuICovXG5cbmltcG9ydCB7QnVpbGRlckNvbnRleHQsIEJ1aWxkZXJPdXRwdXQsIGNyZWF0ZUJ1aWxkZXIsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7SnNvbk9iamVjdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtjaGVja0luc3RhbGxhdGlvbiwgY29weUJhemVsRmlsZXMsIGRlbGV0ZUJhemVsRmlsZXMsIGdldFRlbXBsYXRlRGlyLCBydW5CYXplbH0gZnJvbSAnLi9iYXplbCc7XG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5hc3luYyBmdW5jdGlvbiBfYmF6ZWxCdWlsZGVyKFxuICAgIG9wdGlvbnM6IEpzb25PYmplY3QmU2NoZW1hLFxuICAgIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0LFxuICAgICk6IFByb21pc2U8QnVpbGRlck91dHB1dD4ge1xuICBjb25zdCB7bG9nZ2VyLCB3b3Jrc3BhY2VSb290fSA9IGNvbnRleHQ7XG4gIGNvbnN0IHtiYXplbENvbW1hbmQsIGxlYXZlQmF6ZWxGaWxlc09uRGlzaywgdGFyZ2V0TGFiZWwsIHdhdGNofSA9IG9wdGlvbnM7XG4gIGNvbnN0IGV4ZWN1dGFibGUgPSB3YXRjaCA/ICdpYmF6ZWwnIDogJ2JhemVsJztcbiAgY29uc3QgYmluYXJ5ID0gY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgd29ya3NwYWNlUm9vdCk7XG4gIGNvbnN0IHRlbXBsYXRlRGlyID0gZ2V0VGVtcGxhdGVEaXIod29ya3NwYWNlUm9vdCk7XG4gIGNvbnN0IGJhemVsRmlsZXMgPSBjb3B5QmF6ZWxGaWxlcyh3b3Jrc3BhY2VSb290LCB0ZW1wbGF0ZURpcik7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBmbGFnczogc3RyaW5nW10gPSBbXTtcbiAgICBhd2FpdCBydW5CYXplbCh3b3Jrc3BhY2VSb290LCBiaW5hcnksIGJhemVsQ29tbWFuZCwgdGFyZ2V0TGFiZWwsIGZsYWdzKTtcbiAgICByZXR1cm4ge3N1Y2Nlc3M6IHRydWV9O1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBsb2dnZXIuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgIHJldHVybiB7c3VjY2VzczogZmFsc2V9O1xuICB9IGZpbmFsbHkge1xuICAgIGlmICghbGVhdmVCYXplbEZpbGVzT25EaXNrKSB7XG4gICAgICBkZWxldGVCYXplbEZpbGVzKGJhemVsRmlsZXMpOyAgLy8gdGhpcyB3aWxsIG5ldmVyIHRocm93XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IGNyZWF0ZUJ1aWxkZXIoX2JhemVsQnVpbGRlcik7XG4iXX0=