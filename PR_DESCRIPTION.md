# 🚀 Improve Content-Type Detection in API Call Parser

## 📝 Description

This PR enhances the `handleNone` function in `parseData.ts` to intelligently detect and handle different content types when none is explicitly specified. The improvement addresses a long-standing FIXME comment and significantly improves API reliability.

## 🎯 What This Fixes

**Before**: The `handleNone` function would simply return raw data without attempting to determine the appropriate content type, leading to potential parsing issues.

**After**: The function now:
1. ✅ Checks for explicit `Content-Type` headers (case-insensitive)
2. ✅ Intelligently delegates to appropriate handlers based on detected content type
3. ✅ Implements heuristic detection for JSON, URL-encoded, text, and other formats
4. ✅ Maintains backward compatibility with fallback behavior

## 🔧 Changes Made

### Enhanced Content-Type Detection Logic:
- **Header Analysis**: Checks `content-type` and `Content-Type` headers
- **JSON Detection**: Identifies JSON structures using bracket/brace patterns + validation
- **URL-Encoded Detection**: Recognizes form-encoded data patterns
- **Text Detection**: Falls back to text handling for string data
- **Object Handling**: Automatically stringifies objects for JSON processing

### Code Quality Improvements:
- ✅ Resolves FIXME comment: "try to guess the content type from headers content-type and data"
- ✅ Maintains existing API compatibility
- ✅ Comprehensive error handling with graceful fallbacks
- ✅ Clean, readable implementation with clear logic flow

## 🧪 Testing

- ✅ Project builds successfully without errors
- ✅ All existing functionality preserved
- ✅ CLI tools continue to work as expected
- ✅ No breaking changes introduced

## 📋 Checklist

- [x] Code follows project style guidelines
- [x] Self-review completed
- [x] Functionality tested locally
- [x] No breaking changes
- [x] Commit message follows conventional format
- [x] DCO sign-off included (`git commit -s`)
- [x] FIXME comment addressed and resolved

## 🎉 Impact

This improvement enhances the robustness of API calls within the SmythOS platform by:
- **Reducing parsing errors** through intelligent content-type detection
- **Improving developer experience** with more predictable behavior
- **Maintaining compatibility** while adding new capabilities
- **Following best practices** for content-type handling

---

**Type:** `fix` - Bug fix and improvement  
**Scope:** `core/APICall` - Core API parsing functionality  
**Breaking Change:** ❌ No  

Thank you for reviewing this contribution! 🙏