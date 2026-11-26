// Sample migration for the "Load example" button. Every line is a documented pattern.
export const EXAMPLE_MIGRATION = `class AddFulfillmentFields < ActiveRecord::Migration[7.1]
  def change
    add_index :orders, :customer_id
    add_column :orders, :public_id, :uuid, default: -> { "gen_random_uuid()" }
    add_reference :shipments, :order, index: true, foreign_key: true
    remove_column :orders, :legacy_status
  end
end
`;
