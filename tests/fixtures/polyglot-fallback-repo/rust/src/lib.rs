pub fn inventory_reserve_window_minutes(priority_order: bool) -> u32 {
    if priority_order {
        return 30;
    }
    90
}
