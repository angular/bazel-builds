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
        define("@angular/bazel/src/builders", ["require", "exports", "tslib", "rxjs", "@angular/bazel/src/builders/bazel"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var rxjs_1 = require("rxjs");
    var bazel_1 = require("@angular/bazel/src/builders/bazel");
    var BazelBuilder = /** @class */ (function () {
        function BazelBuilder(context) {
            this.context = context;
        }
        BazelBuilder.prototype.run = function (config) {
            var _this = this;
            var _a = this.context, host = _a.host, logger = _a.logger, workspace = _a.workspace;
            var root = workspace.root;
            var _b = config.options, bazelCommand = _b.bazelCommand, leaveBazelFilesOnDisk = _b.leaveBazelFilesOnDisk, targetLabel = _b.targetLabel, watch = _b.watch;
            var executable = watch ? 'ibazel' : 'bazel';
            var binary = bazel_1.checkInstallation(executable, root);
            return rxjs_1.from(Promise.resolve().then(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                var templateDir, bazelFiles, flags, err_1;
                return tslib_1.__generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, bazel_1.getTemplateDir(host, root)];
                        case 1:
                            templateDir = _a.sent();
                            return [4 /*yield*/, bazel_1.copyBazelFiles(host, root, templateDir)];
                        case 2:
                            bazelFiles = _a.sent();
                            _a.label = 3;
                        case 3:
                            _a.trys.push([3, 5, 6, 9]);
                            flags = [];
                            return [4 /*yield*/, bazel_1.runBazel(root, binary, bazelCommand, targetLabel, flags)];
                        case 4:
                            _a.sent();
                            return [2 /*return*/, { success: true }];
                        case 5:
                            err_1 = _a.sent();
                            logger.error(err_1.message);
                            return [2 /*return*/, { success: false }];
                        case 6:
                            if (!!leaveBazelFilesOnDisk) return [3 /*break*/, 8];
                            return [4 /*yield*/, bazel_1.deleteBazelFiles(host, bazelFiles)];
                        case 7:
                            _a.sent(); // this will never throw
                            _a.label = 8;
                        case 8: return [7 /*endfinally*/];
                        case 9: return [2 /*return*/];
                    }
                });
            }); }));
        };
        return BazelBuilder;
    }());
    exports.default = BazelBuilder;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvYnVpbGRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFJSCw2QkFBc0M7SUFDdEMsMkRBQXNHO0lBR3RHO1FBQ0Usc0JBQW9CLE9BQXVCO1lBQXZCLFlBQU8sR0FBUCxPQUFPLENBQWdCO1FBQUcsQ0FBQztRQUUvQywwQkFBRyxHQUFILFVBQUksTUFBNkM7WUFBakQsaUJBdUJDO1lBdEJPLElBQUEsaUJBQXdDLEVBQXZDLGNBQUksRUFBRSxrQkFBTSxFQUFFLHdCQUF5QixDQUFDO1lBQy9DLElBQU0sSUFBSSxHQUFTLFNBQVMsQ0FBQyxJQUFJLENBQUM7WUFDNUIsSUFBQSxtQkFBb0YsRUFBbkYsOEJBQVksRUFBRSxnREFBcUIsRUFBRSw0QkFBVyxFQUFFLGdCQUFpQyxDQUFDO1lBQzNGLElBQU0sVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7WUFDOUMsSUFBTSxNQUFNLEdBQUcseUJBQWlCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBUyxDQUFDO1lBRTNELE9BQU8sV0FBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUM7Ozs7Z0NBQ2IscUJBQU0sc0JBQWMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUE7OzRCQUE5QyxXQUFXLEdBQUcsU0FBZ0M7NEJBQ2pDLHFCQUFNLHNCQUFjLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxXQUFXLENBQUMsRUFBQTs7NEJBQTFELFVBQVUsR0FBRyxTQUE2Qzs7Ozs0QkFFeEQsS0FBSyxHQUFhLEVBQUUsQ0FBQzs0QkFDM0IscUJBQU0sZ0JBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsS0FBSyxDQUFDLEVBQUE7OzRCQUE5RCxTQUE4RCxDQUFDOzRCQUMvRCxzQkFBTyxFQUFDLE9BQU8sRUFBRSxJQUFJLEVBQUMsRUFBQzs7OzRCQUV2QixNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQzs0QkFDMUIsc0JBQU8sRUFBQyxPQUFPLEVBQUUsS0FBSyxFQUFDLEVBQUM7O2lDQUVwQixDQUFDLHFCQUFxQixFQUF0Qix3QkFBc0I7NEJBQ3hCLHFCQUFNLHdCQUFnQixDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBQTs7NEJBQXhDLFNBQXdDLENBQUMsQ0FBRSx3QkFBd0I7Ozs7OztpQkFHeEUsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDO1FBQ0gsbUJBQUM7SUFBRCxDQUFDLEFBM0JELElBMkJDO0lBRUQsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IEJhemVsIGJ1aWxkZXJcbiAqL1xuXG5pbXBvcnQge0J1aWxkRXZlbnQsIEJ1aWxkZXIsIEJ1aWxkZXJDb25maWd1cmF0aW9uLCBCdWlsZGVyQ29udGV4dH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQge1BhdGh9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7T2JzZXJ2YWJsZSwgZnJvbX0gZnJvbSAncnhqcyc7XG5pbXBvcnQge2NoZWNrSW5zdGFsbGF0aW9uLCBjb3B5QmF6ZWxGaWxlcywgZGVsZXRlQmF6ZWxGaWxlcywgZ2V0VGVtcGxhdGVEaXIsIHJ1bkJhemVsfSBmcm9tICcuL2JhemVsJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbmNsYXNzIEJhemVsQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8U2NoZW1hPiB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29udGV4dDogQnVpbGRlckNvbnRleHQpIHt9XG5cbiAgcnVuKGNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248UGFydGlhbDxTY2hlbWE+Pik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IHtob3N0LCBsb2dnZXIsIHdvcmtzcGFjZX0gPSB0aGlzLmNvbnRleHQ7XG4gICAgY29uc3Qgcm9vdDogUGF0aCA9IHdvcmtzcGFjZS5yb290O1xuICAgIGNvbnN0IHtiYXplbENvbW1hbmQsIGxlYXZlQmF6ZWxGaWxlc09uRGlzaywgdGFyZ2V0TGFiZWwsIHdhdGNofSA9IGNvbmZpZy5vcHRpb25zIGFzIFNjaGVtYTtcbiAgICBjb25zdCBleGVjdXRhYmxlID0gd2F0Y2ggPyAnaWJhemVsJyA6ICdiYXplbCc7XG4gICAgY29uc3QgYmluYXJ5ID0gY2hlY2tJbnN0YWxsYXRpb24oZXhlY3V0YWJsZSwgcm9vdCkgYXMgUGF0aDtcblxuICAgIHJldHVybiBmcm9tKFByb21pc2UucmVzb2x2ZSgpLnRoZW4oYXN5bmMoKSA9PiB7XG4gICAgICBjb25zdCB0ZW1wbGF0ZURpciA9IGF3YWl0IGdldFRlbXBsYXRlRGlyKGhvc3QsIHJvb3QpO1xuICAgICAgY29uc3QgYmF6ZWxGaWxlcyA9IGF3YWl0IGNvcHlCYXplbEZpbGVzKGhvc3QsIHJvb3QsIHRlbXBsYXRlRGlyKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGZsYWdzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBhd2FpdCBydW5CYXplbChyb290LCBiaW5hcnksIGJhemVsQ29tbWFuZCwgdGFyZ2V0TGFiZWwsIGZsYWdzKTtcbiAgICAgICAgcmV0dXJuIHtzdWNjZXNzOiB0cnVlfTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICByZXR1cm4ge3N1Y2Nlc3M6IGZhbHNlfTtcbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIGlmICghbGVhdmVCYXplbEZpbGVzT25EaXNrKSB7XG4gICAgICAgICAgYXdhaXQgZGVsZXRlQmF6ZWxGaWxlcyhob3N0LCBiYXplbEZpbGVzKTsgIC8vIHRoaXMgd2lsbCBuZXZlciB0aHJvd1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSkpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJhemVsQnVpbGRlcjtcbiJdfQ==