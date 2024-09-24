/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
/**
 * Bundles the specified entry-point and writes the output `d.ts` bundle to the specified
 * output path. An optional license banner can be provided to be added to the bundle output.
 */
export declare function runMain({ entryPointExecpath, outputExecpath, packageJsonExecpath, licenseBannerExecpath, }: {
    entryPointExecpath: string;
    outputExecpath: string;
    packageJsonExecpath: string;
    licenseBannerExecpath: string | undefined;
}): Promise<void>;
