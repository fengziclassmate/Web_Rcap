/** Serialize the short, synchronous draft handoff across tabs, including browsers without Web Locks. */
export async function withScheduleDraftLock(owner: string, work: () => void): Promise<void> {
  if (navigator.locks) return navigator.locks.request(`schedule-draft-handoff:${owner}`, work);
  if (typeof indexedDB === "undefined") throw new Error("浏览器无法协调本机草稿，请启用浏览器存储后重试。");
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open("schedule-draft-coordination", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("handoff"); };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error("本机存储正在升级，请关闭其他工作台页面后刷新。"));
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("handoff", "readwrite");
      // IndexedDB serializes readwrite transactions for this store across all tabs.
      const request = transaction.objectStore("handoff").get(owner);
      request.onsuccess = () => {
        try { work(); transaction.objectStore("handoff").put(1, owner); }
        catch (error) { transaction.abort(); reject(error); }
      };
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("草稿协调失败")); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  });
}
