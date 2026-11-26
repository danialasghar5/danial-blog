class RequireStatusOnOrders < ActiveRecord::Migration[7.1]
  def change
    change_column_null :orders, :status, false
  end
end
