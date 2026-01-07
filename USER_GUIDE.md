# MOH Registers - User Guide

**Offline-First Health Data Management System**

Version: 3.0
Last Updated: 2024

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Key Features](#key-features)
4. [Using the Application](#using-the-application)
5. [Offline Functionality](#offline-functionality)
6. [Sync Status & Indicators](#sync-status--indicators)
7. [Draft Recovery](#draft-recovery)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)
10. [FAQ](#faq)

---

## Introduction

MOH Registers is an offline-first health data management system designed for healthcare facilities. The application allows you to register patients, record visits, and manage health data even when internet connectivity is unreliable or unavailable.

### Key Benefits

- **Offline-First**: Work seamlessly without internet connection
- **Auto-Save**: Never lose your work with automatic draft saving
- **Background Sync**: Data syncs automatically when online
- **Real-Time Status**: Always know your sync status
- **Data Recovery**: Recover unsaved drafts anytime

---

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, or Edge)
- Minimum 100MB available storage for offline data
- Internet connection for initial setup and periodic syncing

### First Launch

1. Open the application in your web browser
2. Log in with your DHIS2 credentials
3. Wait for initial data synchronization
4. Once synced, you can work offline

---

## Key Features

### 1. Offline-First Architecture

The application stores all data locally on your device using IndexedDB, allowing you to:
- Register new patients without internet
- Record visits and health data offline
- View patient history anytime
- Queue changes for automatic sync when online

### 2. Auto-Save

Forms automatically save every 30 seconds to prevent data loss:
- Registration forms auto-save as drafts
- Visit forms auto-save progress
- Drafts persist across browser sessions
- Recover drafts from the header menu

### 3. Background Sync

When online, the application automatically:
- Syncs queued changes every 30 seconds
- Prioritizes critical operations
- Retries failed operations up to 3 times
- Shows sync progress in real-time

### 4. Smart State Management

Using XState for predictable data flow:
- Prevents invalid operations
- Ensures data consistency
- Manages modal states correctly
- Tracks operation lifecycle

---

## Using the Application

### Application Header

The header provides quick access to key features:

```
┌─────────────────────────────────────────────────────────┐
│ 🗄️ MOH Registers    [Drafts] | [Sync Status: ✅ Synced] │
└─────────────────────────────────────────────────────────┘
```

- **Title**: Application name and branding
- **Drafts Button**: Access saved drafts
- **Sync Status**: Real-time sync indicator

### Registering a Patient

1. Navigate to the Patient List
2. Click "Register New Patient"
3. Fill in required fields:
   - First Name
   - Last Name
   - Date of Birth
   - Gender
   - Other attributes
4. Click "Save" or let auto-save handle it
5. Patient is saved locally and queued for sync

### Recording a Visit

1. Select a patient from the list
2. Click "Create Visit" or "Add Event"
3. Fill in visit details:
   - Visit date
   - Diagnosis
   - Lab tests
   - Treatment notes
4. Save the visit
5. Visit is queued for background sync

### Viewing Patient History

1. Select a patient from the list
2. View patient details and attributes
3. Scroll to see visit history
4. Click any visit to view details
5. Edit visits if needed

---

## Offline Functionality

### Working Offline

When offline, you can:
- ✅ Register new patients
- ✅ Record visits
- ✅ View patient history
- ✅ Edit existing data
- ✅ Access saved drafts
- ❌ Sync data (queued automatically)

### What Happens Offline?

1. All changes are saved to local database (IndexedDB)
2. Operations are queued for sync
3. Sync status shows "Offline" with pending count
4. Data remains safe on your device
5. Automatic sync resumes when online

### Going Back Online

When connection is restored:
1. Sync status changes to "Syncing"
2. Queued operations sync automatically
3. Priority-based processing (critical first)
4. Retry logic for failed operations
5. Status updates to "Synced" when complete

---

## Sync Status & Indicators

### Status Icons

- **🟢 Synced**: All data synchronized, no pending operations
- **🔵 Syncing**: Currently syncing data to server
- **🟡 Pending**: Operations queued for sync (X pending)
- **🔴 Offline**: No internet connection, working offline

### Status Tooltip

Hover over the sync status to see detailed information:

```
Network: Online (4G)
Sync Status: syncing
Pending: 3 operation(s)
Last sync: 2:30 PM
```

### Network Indicators

The application shows:
- Online/Offline status
- Connection type (4G, WiFi, etc.)
- Pending operation count
- Last successful sync timestamp
- Offline mode warnings

---

## Draft Recovery

### What are Drafts?

Drafts are automatically saved form data that help you:
- Resume interrupted work
- Recover from browser crashes
- Switch between multiple registrations
- Prevent data loss

### Accessing Drafts

1. Click the "Drafts" button in the header
2. View list of saved drafts
3. See draft type (Visit or Registration)
4. Check last saved time
5. Recover or delete drafts

### Draft Types

**Visit Drafts**
- Auto-saved every 30 seconds
- Include all form fields
- Associated with specific patient
- Deleted after successful submission

**Registration Drafts**
- Auto-saved during registration
- Include patient attributes
- Can be recovered anytime
- Deleted after successful registration

### Recovering a Draft

1. Open the Drafts modal
2. Find your draft in the list
3. Click "Recover"
4. Form opens with saved data
5. Complete and submit

### Deleting Drafts

1. Open the Drafts modal
2. Find the draft to delete
3. Click "Delete"
4. Confirm deletion
5. Draft is permanently removed

---

## Troubleshooting

### Common Issues

#### 1. "Network connection issue"

**Symptoms**: Cannot connect to server

**Solutions**:
- Check your internet connection
- Verify you're not behind a firewall
- Try refreshing the page
- Work offline and sync later

#### 2. "Local database issue"

**Symptoms**: Data not saving locally

**Solutions**:
- Check available storage space
- Clear browser cache (after backup)
- Try a different browser
- Contact support if persistent

#### 3. "Sync operation failed"

**Symptoms**: Pending operations won't sync

**Solutions**:
- Wait for automatic retry (up to 3 attempts)
- Check server status
- Verify your permissions
- Check operation details in console

#### 4. "Multiple errors detected"

**Symptoms**: Error boundary shows multiple errors

**Solutions**:
- Click "Reload Page"
- Clear browser cache
- Check browser console for details
- Report issue to support

### Error Recovery

The application has built-in error handling:

1. **Automatic Retry**: Failed sync operations retry up to 3 times
2. **Error Boundary**: Catches and handles errors gracefully
3. **Data Preservation**: Your data is safe even during errors
4. **Recovery Options**: Multiple ways to recover from errors

### Getting Help

If you encounter persistent issues:

1. Check browser console (F12)
2. Note the error message
3. Check your network status
4. Try the solutions above
5. Contact your system administrator

---

## Best Practices

### Data Management

✅ **Do**:
- Let auto-save work (wait 30 seconds between saves)
- Check sync status regularly
- Recover drafts after interruptions
- Work offline when needed
- Keep browser updated

❌ **Don't**:
- Close browser during sync
- Clear cache without backup
- Disable JavaScript
- Use multiple tabs simultaneously
- Ignore error messages

### Performance Tips

1. **Regular Syncing**: Connect to internet periodically
2. **Draft Cleanup**: Delete old drafts you don't need
3. **Browser Maintenance**: Clear old cache data monthly
4. **Storage Management**: Monitor available storage
5. **Update Regularly**: Keep application updated

### Data Safety

1. **Let Sync Complete**: Don't close during sync
2. **Verify Submissions**: Check sync status after saving
3. **Backup Important Data**: Use drafts for safety
4. **Report Errors**: Help improve the system
5. **Follow Guidelines**: Use application as intended

---

## FAQ

### General Questions

**Q: Can I use the application without internet?**
A: Yes! The application is designed to work offline. All features are available offline except syncing data to the server.

**Q: How often does auto-save happen?**
A: Forms auto-save every 30 seconds while you're working on them.

**Q: How often does background sync occur?**
A: When online, the application syncs every 30 seconds automatically.

**Q: What happens if I close the browser?**
A: Your data is safe! Drafts are saved and pending sync operations are queued.

**Q: Can I work on multiple devices?**
A: Yes, but data syncs per device. Make sure to sync before switching devices.

### Technical Questions

**Q: What browsers are supported?**
A: Chrome, Firefox, Safari, and Edge (latest versions).

**Q: How much storage does the application use?**
A: Typically 50-200MB depending on data volume. The browser manages storage automatically.

**Q: Is my data secure?**
A: Yes! Data is stored securely in IndexedDB with same-origin policy protection.

**Q: What happens if storage is full?**
A: The browser will show a warning. Delete old drafts or clear cache to free space.

**Q: Can I export my offline data?**
A: Data syncs to DHIS2 server automatically. Contact your administrator for exports.

### Sync Questions

**Q: Why is sync taking so long?**
A: Large operations or slow networks can delay sync. Be patient and let it complete.

**Q: What if sync fails?**
A: The system retries up to 3 times automatically. Check your connection and try again.

**Q: How do I know sync is complete?**
A: Watch the sync status indicator. It shows "Synced" when all operations complete.

**Q: Can I force a sync?**
A: Sync happens automatically. If you're online, just wait 30 seconds for the next sync cycle.

**Q: What operations sync first?**
A: Critical operations (registrations, new visits) have higher priority than updates.

### Draft Questions

**Q: How long are drafts kept?**
A: Drafts persist indefinitely until you delete them or successfully submit the form.

**Q: Why are there multiple drafts?**
A: Each form creates its own draft. Auto-save creates new drafts for each incomplete form.

**Q: Can I recover a deleted draft?**
A: No, deletion is permanent. Be careful when deleting drafts.

**Q: Do drafts sync across devices?**
A: No, drafts are stored locally per device.

---

## Testing & Development

For developers and testers, testing utilities are available in development mode.

### Test Helpers

Open browser console and access:

```javascript
// Available in development mode
window.testHelpers

// Clear all data
testHelpers.clearDatabase()

// Seed test data
testHelpers.seedTestData({
    trackedEntities: 10,
    eventsPerEntity: 5,
    drafts: 3
})

// Simulate offline
testHelpers.simulateOffline()

// Simulate online
testHelpers.simulateOnline()

// View database stats
testHelpers.printDatabaseStats()
```

See [src/utils/test-helpers.ts](src/utils/test-helpers.ts) for full API.

---

## Support & Resources

### Documentation

- **Implementation Summary**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
- **Technical Documentation**: See `/src/db/` folder
- **API Documentation**: Check component JSDoc comments

### Getting Help

1. Check this user guide
2. Review troubleshooting section
3. Check browser console for errors
4. Contact your system administrator
5. Report bugs to development team

### Version History

- **v3.0**: Added offline-first architecture, auto-save, sync manager
- **v2.0**: Added XState integration, improved state management
- **v1.0**: Initial release with basic functionality

---

## Conclusion

MOH Registers is designed to provide reliable health data management even in challenging network conditions. By leveraging offline-first architecture, auto-save, and background sync, you can focus on patient care without worrying about data loss or connectivity issues.

**Remember**:
- ✅ Work offline with confidence
- ✅ Trust auto-save to protect your work
- ✅ Monitor sync status regularly
- ✅ Recover drafts when needed
- ✅ Report issues to help improve the system

Thank you for using MOH Registers!
