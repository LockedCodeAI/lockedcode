/**
 * License signature database.
 * Each signature is a pre-computed fingerprint (set of n-gram hashes)
 * from known copyleft-licensed code that LLMs commonly reproduce.
 */

import { fingerprint, type CodeFingerprint } from "./fingerprint"

export interface LicenseSignature {
  readonly id: string
  readonly sourceProject: string
  readonly licenseSPDX: string
  readonly moduleName: string
  readonly fp: CodeFingerprint
}

/**
 * Create a signature from raw code.
 */
function sig(id: string, project: string, license: string, module: string, code: string): LicenseSignature {
  return { id, sourceProject: project, licenseSPDX: license, moduleName: module, fp: fingerprint(code) }
}

/**
 * Bundled license signatures.
 * These are representative patterns from commonly reproduced copyleft code.
 * The actual detection works via n-gram similarity, not exact matching.
 */
export function loadSignatures(): LicenseSignature[] {
  return [
    // GPL-2.0 — GNU Coreutils patterns
    sig("sig-gnu-sort-cmp", "gnu-coreutils", "GPL-2.0", "sort.c:cmp", `
      int cmp (char *a, char *b) {
        while (*a && *a == *b) { a++; b++; }
        return (unsigned char)*a - (unsigned char)*b;
      }
    `),
    sig("sig-gnu-unique", "gnu-coreutils", "GPL-2.0", "uniq.c", `
      int differ (char *a, char *b) {
        while (*a && *a == *b) { a++; b++; }
        return *a != *b;
      }
    `),

    // GPL-2.0 — Linux kernel patterns (commonly reproduced)
    sig("sig-linux-list", "linux-kernel", "GPL-2.0", "list.h:list_for_each", `
      struct list_head {
        struct list_head *next, *prev;
      };
      void init_list_head(struct list_head *list) {
        list->next = list;
        list->prev = list;
      }
    `),
    sig("sig-linux-queue", "linux-kernel", "GPL-2.0", "kfifo.h", `
      struct kfifo {
        unsigned char *buffer;
        unsigned int size;
        unsigned int in;
        unsigned int out;
      };
    `),

    // GPL-3.0 — GCC patterns
    sig("sig-gcc-tree", "gcc", "GPL-3.0", "tree.h:tree_node", `
      union tree_node {
        struct tree_int_cst { intval; } int_cst;
        struct tree_real_cst { real; } real_cst;
      };
    `),

    // AGPL-3.0 — MongoDB patterns (commonly reproduced)
    sig("sig-mongo-bson", "mongodb", "AGPL-3.0", "bson.h:bson_t", `
      typedef struct {
        uint32_t len;
        uint8_t data[];
      } bson_t;
      bson_t *bson_new(void) {
        bson_t *b = calloc(1, sizeof(bson_t) + 5);
        b->len = 5;
        return b;
      }
    `),

    // LGPL-2.1 — glibc patterns
    sig("sig-glibc-strlen", "glibc", "LGPL-2.1", "string/strlen.c", `
      size_t strlen(const char *str) {
        const char *s = str;
        while (*s) s++;
        return s - str;
      }
    `),
    sig("sig-glibc-memcpy", "glibc", "LGPL-2.1", "string/memcpy.c", `
      void *memcpy(void *dest, const void *src, size_t n) {
        unsigned char *d = dest;
        const unsigned char *s = src;
        while (n--) *d++ = *s++;
        return dest;
      }
    `),

    // LGPL-2.1 — libcurl patterns
    sig("sig-curl-escape", "curl", "LGPL-2.1", "escape.c", `
      char *curl_escape(const char *str, int length) {
        char *output = malloc(length * 3 + 1);
        char *out = output;
        while (*str) {
          *out++ = '%';
          *out++ = hex[*str >> 4];
          *out++ = hex[*str & 15];
          str++;
        }
        *out = 0;
        return output;
      }
    `),

    // MPL-2.0 — Mozilla patterns
    sig("sig-nss-base64", "nss", "MPL-2.0", "base64.c", `
      static const char base64_table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      int base64_encode(const unsigned char *src, int len, char *dst) {
        int i = 0, j = 0;
        while (i < len) {
          dst[j++] = base64_table[src[i] >> 2];
          dst[j++] = base64_table[((src[i] & 3) << 4) | (src[i + 1] >> 4)];
          dst[j++] = base64_table[((src[i + 1] & 15) << 2) | (src[i + 2] >> 6)];
          dst[j++] = base64_table[src[i + 2] & 63];
          i += 3;
        }
        return j;
      }
    `),
  ]
}
