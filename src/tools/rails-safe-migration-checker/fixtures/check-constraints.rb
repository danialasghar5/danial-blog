class AddOrderTotalChecks < ActiveRecord::Migration[7.1]
  def change
    add_check_constraint :orders, "total_cents >= 0", name: "orders_total_nonnegative"
    add_check_constraint :orders, "total_cents <= 10000000", name: "orders_total_cap", validate: false
    validate_check_constraint :orders, name: "orders_total_cap"
  end
end
