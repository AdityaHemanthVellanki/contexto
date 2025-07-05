/**
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please use the new secure implementation from @/lib/firebase instead.
 */

import { app, auth, db } from '@/lib/firebase';

// Re-export Firebase services for backward compatibility
export { app, auth, db };
export default { app, auth, db };
