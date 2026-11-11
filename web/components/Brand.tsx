import Link from "next/link";
import styles from "./Brand.module.css";

export function Brand() {
  return <Link href="/" className={styles.brand} aria-label="iCPM - Interactive Carbon Property Matrix">
    <span className={styles.wordmark}><span>i</span>CPM</span>
    <span className={styles.subtitle}>Interactive Carbon Property Matrix</span>
  </Link>;
}
