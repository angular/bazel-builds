/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import { BazelFileInfo, PackageMetadata } from './api';
/**
 * Analyzes the given JavaScript source file and checks whether there are
 * any relative imports that point to different entry-points or packages.
 *
 * Such imports are flagged and will be returned in the failure list. Cross
 * entry-point or package imports result in duplicate code and therefore are
 * forbidden (unless explicitly opted out via comment - {@link skipComment}).
 */
export declare function analyzeFileAndEnsureNoCrossImports(file: BazelFileInfo, pkg: PackageMetadata): string[];
