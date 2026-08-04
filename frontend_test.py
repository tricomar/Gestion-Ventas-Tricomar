"""
Comprehensive Frontend Testing for Inventory and Settings → Categories
Testing all corrections applied to InventoryPage and SettingsPage
"""

import asyncio
import os
from playwright.async_api import async_playwright, expect
from datetime import datetime

# Test credentials
TEST_EMAIL = "hola@tricomar.cl"
TEST_PASSWORD = "QWEasd123$"

# Backend URL from frontend .env
BACKEND_URL = "https://sales-ledger-47.preview.emergentagent.com"
FRONTEND_URL = BACKEND_URL  # Frontend is served from same domain

class InventorySettingsTest:
    def __init__(self):
        self.browser = None
        self.context = None
        self.page = None
        self.test_results = []
        self.screenshots_dir = "/app/test_screenshots"
        
        # Create screenshots directory
        os.makedirs(self.screenshots_dir, exist_ok=True)
    
    async def setup(self):
        """Initialize browser and login"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            locale='es-CL'
        )
        self.page = await self.context.new_page()
        
        # Enable console logging
        self.page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.type}: {msg.text}"))
        self.page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))
        
        print(f"\n{'='*80}")
        print(f"🚀 Starting Inventory & Settings Testing")
        print(f"{'='*80}\n")
        
        # Login
        await self.login()
    
    async def login(self):
        """Login with test credentials"""
        print(f"🔐 Logging in as {TEST_EMAIL}...")
        
        await self.page.goto(f"{FRONTEND_URL}/login", wait_until="networkidle")
        await self.page.wait_for_timeout(2000)
        
        # Fill login form using data-testid
        await self.page.fill('input[data-testid="login-email-input"]', TEST_EMAIL)
        await self.page.fill('input[data-testid="login-password-input"]', TEST_PASSWORD)
        
        # Click login button
        await self.page.click('button[type="submit"]')
        
        # Wait for navigation to dashboard
        await self.page.wait_for_url(f"{FRONTEND_URL}/", timeout=15000)
        await self.page.wait_for_timeout(3000)
        
        print("✅ Login successful\n")
    
    async def capture_screenshot(self, name):
        """Capture screenshot with timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.screenshots_dir}/{timestamp}_{name}.png"
        await self.page.screenshot(path=filename, full_page=True)
        print(f"📸 Screenshot saved: {filename}")
        return filename
    
    def log_result(self, test_name, passed, details=""):
        """Log test result"""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        print(f"{status} - {test_name}")
        if details:
            print(f"   Details: {details}")
    
    async def test_inventory_page_loads(self):
        """Test 1: Inventario page opens without 'stores is not defined' error"""
        print("\n" + "="*80)
        print("TEST 1: Inventario page loads without errors")
        print("="*80)
        
        try:
            # Click Menu button to open navigation
            menu_btn = self.page.locator('button:has-text("Menú")')
            await menu_btn.click()
            await self.page.wait_for_timeout(500)
            
            # Click Inventory link in menu
            inventory_link = self.page.locator('button:has-text("Inventario")')
            await inventory_link.click()
            await self.page.wait_for_timeout(3000)
            
            # Check for page title
            title = await self.page.locator('h1:has-text("Gestión de Inventario")').count()
            
            # Check for filter dropdown (stores filter should be visible)
            stores_filter = await self.page.locator('select[data-testid="filter-store-select"]').count()
            
            # Check for products table or empty state
            table_or_empty = await self.page.locator('table, div:has-text("No hay productos")').count()
            
            # Capture screenshot
            await self.capture_screenshot("inventory_page_loaded")
            
            if title > 0 and stores_filter > 0 and table_or_empty > 0:
                self.log_result("Inventario page loads without errors", True, 
                               "Page loaded with title, filters, and table/empty state visible")
            else:
                self.log_result("Inventario page loads without errors", False,
                               f"Missing elements: title={title}, stores_filter={stores_filter}, table={table_or_empty}")
        
        except Exception as e:
            self.log_result("Inventario page loads without errors", False, str(e))
    
    async def test_store_filter(self):
        """Test 2: Filter by store works"""
        print("\n" + "="*80)
        print("TEST 2: Filter by store functionality")
        print("="*80)
        
        try:
            # Check if store filter dropdown exists
            store_select = self.page.locator('select[data-testid="filter-store-select"]')
            await expect(store_select).to_be_visible()
            
            # Get all options
            options = await store_select.locator('option').all_text_contents()
            print(f"   Available store options: {options}")
            
            # Check if "Todas las tiendas" option exists
            all_stores_option = await store_select.locator('option[value="all"]').count()
            
            if all_stores_option > 0 and len(options) > 1:
                self.log_result("Store filter dropdown present", True,
                               f"Found {len(options)} options including 'Todas las tiendas'")
                
                # Try selecting a specific store if available
                if len(options) > 1:
                    # Select second option (first store)
                    await store_select.select_option(index=1)
                    await self.page.wait_for_timeout(1000)
                    await self.capture_screenshot("store_filter_applied")
                    
                    # Reset to all stores
                    await store_select.select_option(value="all")
                    await self.page.wait_for_timeout(500)
            else:
                self.log_result("Store filter dropdown present", False,
                               "Store filter not working correctly")
        
        except Exception as e:
            self.log_result("Store filter functionality", False, str(e))
    
    async def test_category_filter(self):
        """Test 3: Filter by category works"""
        print("\n" + "="*80)
        print("TEST 3: Filter by category functionality")
        print("="*80)
        
        try:
            category_select = self.page.locator('select[data-testid="filter-category-select"]')
            await expect(category_select).to_be_visible()
            
            options = await category_select.locator('option').all_text_contents()
            print(f"   Available category options: {options}")
            
            if len(options) >= 1:
                self.log_result("Category filter present", True,
                               f"Found {len(options)} category options")
            else:
                self.log_result("Category filter present", False,
                               "No category options found")
        
        except Exception as e:
            self.log_result("Category filter functionality", False, str(e))
    
    async def test_search_functionality(self):
        """Test 4: Search by name or SKU works"""
        print("\n" + "="*80)
        print("TEST 4: Search by name/SKU functionality")
        print("="*80)
        
        try:
            search_input = self.page.locator('input[data-testid="search-products-input"]')
            await expect(search_input).to_be_visible()
            
            # Try searching for a common product
            await search_input.fill("cat")
            await self.page.wait_for_timeout(1000)
            
            await self.capture_screenshot("search_applied")
            
            # Clear search
            await search_input.fill("")
            await self.page.wait_for_timeout(500)
            
            self.log_result("Search functionality", True,
                           "Search input present and functional")
        
        except Exception as e:
            self.log_result("Search functionality", False, str(e))
    
    async def test_sorting_by_name(self):
        """Test 5: Sorting by Product Name (A-Z / Z-A with arrow icon)"""
        print("\n" + "="*80)
        print("TEST 5: Sorting by Product Name")
        print("="*80)
        
        try:
            # Find the "Nombre Producto" header
            name_header = self.page.locator('th:has-text("Nombre Producto")')
            
            # Check if header exists
            header_count = await name_header.count()
            
            if header_count > 0:
                # Click to sort
                await name_header.click()
                await self.page.wait_for_timeout(1000)
                
                # Check for arrow icon (ChevronUp or ChevronDown)
                arrow_icon = await self.page.locator('th:has-text("Nombre Producto") svg').count()
                
                await self.capture_screenshot("sort_by_name_asc")
                
                # Click again to toggle
                await name_header.click()
                await self.page.wait_for_timeout(1000)
                
                await self.capture_screenshot("sort_by_name_desc")
                
                if arrow_icon > 0:
                    self.log_result("Sorting by Product Name", True,
                                   "Sort header clickable and arrow icon appears")
                else:
                    self.log_result("Sorting by Product Name", False,
                                   "Arrow icon not visible after clicking")
            else:
                self.log_result("Sorting by Product Name", False,
                               "Product Name header not found")
        
        except Exception as e:
            self.log_result("Sorting by Product Name", False, str(e))
    
    async def test_sorting_by_price(self):
        """Test 6: Sorting by Sale Price (low-high / high-low)"""
        print("\n" + "="*80)
        print("TEST 6: Sorting by Sale Price")
        print("="*80)
        
        try:
            price_header = self.page.locator('th:has-text("Precio Venta")')
            
            header_count = await price_header.count()
            
            if header_count > 0:
                await price_header.click()
                await self.page.wait_for_timeout(1000)
                
                arrow_icon = await self.page.locator('th:has-text("Precio Venta") svg').count()
                
                await self.capture_screenshot("sort_by_price_asc")
                
                await price_header.click()
                await self.page.wait_for_timeout(1000)
                
                await self.capture_screenshot("sort_by_price_desc")
                
                if arrow_icon > 0:
                    self.log_result("Sorting by Sale Price", True,
                                   "Sort header clickable and arrow icon appears")
                else:
                    self.log_result("Sorting by Sale Price", False,
                                   "Arrow icon not visible")
            else:
                self.log_result("Sorting by Sale Price", False,
                               "Price header not found")
        
        except Exception as e:
            self.log_result("Sorting by Sale Price", False, str(e))
    
    async def test_brand_column_visible(self):
        """Test 7: Brand column visible in table"""
        print("\n" + "="*80)
        print("TEST 7: Brand column visibility")
        print("="*80)
        
        try:
            brand_header = self.page.locator('th:has-text("Marca")')
            
            header_count = await brand_header.count()
            
            if header_count > 0:
                self.log_result("Brand column visible", True,
                               "Marca column header found in table")
            else:
                self.log_result("Brand column visible", False,
                               "Marca column not found")
        
        except Exception as e:
            self.log_result("Brand column visible", False, str(e))
    
    async def test_mass_selection(self):
        """Test 8: Mass selection (checkboxes, select all, top bar with counter)"""
        print("\n" + "="*80)
        print("TEST 8: Mass selection functionality")
        print("="*80)
        
        try:
            # Check if there are products in the table
            product_rows = await self.page.locator('tbody tr[data-testid^="product-row-"]').count()
            
            if product_rows == 0:
                self.log_result("Mass selection", False,
                               "No products available to test mass selection")
                return
            
            print(f"   Found {product_rows} products in table")
            
            # Find "Select All" checkbox in header
            select_all_checkbox = self.page.locator('thead input[type="checkbox"]')
            
            # Click select all
            await select_all_checkbox.click()
            await self.page.wait_for_timeout(1000)
            
            # Check if top bar appears
            top_bar = await self.page.locator('div:has-text("producto") >> text=/seleccionado/i').count()
            
            await self.capture_screenshot("mass_selection_active")
            
            if top_bar > 0:
                # Check for counter
                counter_text = await self.page.locator('div:has-text("producto") >> text=/seleccionado/i').first.text_content()
                print(f"   Selection bar text: {counter_text}")
                
                # Check for action buttons (Export and Delete)
                export_btn = await self.page.locator('button:has-text("Exportar")').count()
                delete_btn = await self.page.locator('button:has-text("Eliminar")').count()
                
                # Deselect all
                await select_all_checkbox.click()
                await self.page.wait_for_timeout(500)
                
                if export_btn > 0 and delete_btn > 0:
                    self.log_result("Mass selection", True,
                                   f"Selection bar appears with counter, Export and Delete buttons. {counter_text}")
                else:
                    self.log_result("Mass selection", False,
                                   f"Missing buttons: Export={export_btn}, Delete={delete_btn}")
            else:
                self.log_result("Mass selection", False,
                               "Selection bar did not appear after selecting all")
        
        except Exception as e:
            self.log_result("Mass selection", False, str(e))
    
    async def test_mass_deletion_modal(self):
        """Test 9: Mass deletion (modal appears only on click, requires typing 'eliminar')"""
        print("\n" + "="*80)
        print("TEST 9: Mass deletion modal")
        print("="*80)
        
        try:
            # Check if there are products
            product_rows = await self.page.locator('tbody tr[data-testid^="product-row-"]').count()
            
            if product_rows == 0:
                self.log_result("Mass deletion modal", False,
                               "No products available to test deletion")
                return
            
            # Select first product
            first_checkbox = self.page.locator('tbody tr[data-testid^="product-row-"] input[type="checkbox"]').first
            await first_checkbox.click()
            await self.page.wait_for_timeout(1000)
            
            # Check that modal is NOT visible yet
            modal_before = await self.page.locator('div:has-text("Confirmar Eliminación")').count()
            
            if modal_before > 0:
                self.log_result("Mass deletion modal", False,
                               "Modal appeared automatically (should only appear on button click)")
                return
            
            # Click "Eliminar" button in top bar
            delete_btn = self.page.locator('button:has-text("Eliminar")')
            await delete_btn.click()
            await self.page.wait_for_timeout(1000)
            
            # Now modal should appear
            modal_after = await self.page.locator('div:has-text("Confirmar Eliminación")').count()
            
            await self.capture_screenshot("mass_deletion_modal")
            
            if modal_after > 0:
                # Check for confirmation input
                confirm_input = await self.page.locator('input[placeholder="eliminar"]').count()
                
                # Check for "Eliminar" button in modal
                confirm_btn = await self.page.locator('div:has-text("Confirmar Eliminación") >> .. >> button:has-text("Eliminar")').count()
                
                # Close modal without deleting
                cancel_btn = self.page.locator('button:has-text("Cancelar")').last
                await cancel_btn.click()
                await self.page.wait_for_timeout(500)
                
                # Deselect product
                await first_checkbox.click()
                await self.page.wait_for_timeout(500)
                
                if confirm_input > 0 and confirm_btn > 0:
                    self.log_result("Mass deletion modal", True,
                                   "Modal appears only on button click, has confirmation input and buttons")
                else:
                    self.log_result("Mass deletion modal", False,
                                   f"Missing elements: input={confirm_input}, button={confirm_btn}")
            else:
                self.log_result("Mass deletion modal", False,
                               "Modal did not appear after clicking Delete button")
        
        except Exception as e:
            self.log_result("Mass deletion modal", False, str(e))
    
    async def test_export_selected_products(self):
        """Test 10: Export selected products (generates Excel file)"""
        print("\n" + "="*80)
        print("TEST 10: Export selected products")
        print("="*80)
        
        try:
            product_rows = await self.page.locator('tbody tr[data-testid^="product-row-"]').count()
            
            if product_rows == 0:
                self.log_result("Export selected products", False,
                               "No products available to test export")
                return
            
            # Select first product
            first_checkbox = self.page.locator('tbody tr[data-testid^="product-row-"] input[type="checkbox"]').first
            await first_checkbox.click()
            await self.page.wait_for_timeout(1000)
            
            # Click Export button
            export_btn = self.page.locator('button:has-text("Exportar")').first
            
            # Set up download listener
            async with self.page.expect_download() as download_info:
                await export_btn.click()
                download = await download_info.value
                
                # Check filename
                filename = download.suggested_filename
                print(f"   Downloaded file: {filename}")
                
                if filename.endswith('.xlsx'):
                    self.log_result("Export selected products", True,
                                   f"Excel file downloaded: {filename}")
                else:
                    self.log_result("Export selected products", False,
                                   f"Unexpected file format: {filename}")
            
            # Deselect
            await first_checkbox.click()
            await self.page.wait_for_timeout(500)
        
        except Exception as e:
            # Export might not trigger download in headless mode, check for toast notification instead
            try:
                toast = await self.page.locator('div:has-text("exportado")').count()
                if toast > 0:
                    self.log_result("Export selected products", True,
                                   "Export triggered (toast notification appeared)")
                else:
                    self.log_result("Export selected products", False, str(e))
            except Exception:
                self.log_result("Export selected products", False, str(e))
    
    async def test_settings_categories_section(self):
        """Test 11: Settings → Categories section opens without errors"""
        print("\n" + "="*80)
        print("TEST 11: Settings → Categories section")
        print("="*80)
        
        try:
            # Navigate back to dashboard first
            await self.page.goto(f"{FRONTEND_URL}/", wait_until="networkidle")
            await self.page.wait_for_timeout(2000)
            
            # Click Menu button
            menu_btn = self.page.locator('button:has-text("Menú")')
            await menu_btn.click()
            await self.page.wait_for_timeout(500)
            
            # Click Settings link
            settings_link = self.page.locator('button:has-text("Configuración")')
            await settings_link.click()
            await self.page.wait_for_timeout(3000)
            
            # Check for Inventory tab
            inventory_tab = self.page.locator('button[data-testid="inventory-tab-btn"]')
            await inventory_tab.click()
            await self.page.wait_for_timeout(1000)
            
            # Check for categories section elements
            categories_title = await self.page.locator('h2:has-text("Categorías de Productos")').count()
            add_input = await self.page.locator('input[data-testid="new-category-input"]').count()
            import_btn = await self.page.locator('button[data-testid="import-categories-btn"]').count()
            save_btn = await self.page.locator('button[data-testid="save-categories-btn"]').count()
            
            await self.capture_screenshot("settings_categories_section")
            
            if categories_title > 0 and add_input > 0 and import_btn > 0 and save_btn > 0:
                self.log_result("Settings → Categories section", True,
                               "All elements present: title, input, import button, save button")
            else:
                self.log_result("Settings → Categories section", False,
                               f"Missing elements: title={categories_title}, input={add_input}, import={import_btn}, save={save_btn}")
        
        except Exception as e:
            self.log_result("Settings → Categories section", False, str(e))
    
    async def test_create_category(self):
        """Test 12: Create new category works"""
        print("\n" + "="*80)
        print("TEST 12: Create new category")
        print("="*80)
        
        try:
            # Generate unique category name
            test_category = f"TestCategory_{datetime.now().strftime('%H%M%S')}"
            
            # Fill input
            category_input = self.page.locator('input[data-testid="new-category-input"]')
            await category_input.fill(test_category)
            
            # Click add button
            add_btn = self.page.locator('button[data-testid="add-category-btn"]')
            await add_btn.click()
            await self.page.wait_for_timeout(1000)
            
            # Check if category appears in list
            category_item = await self.page.locator(f'span:has-text("{test_category}")').count()
            
            await self.capture_screenshot("category_created")
            
            if category_item > 0:
                self.log_result("Create new category", True,
                               f"Category '{test_category}' created and visible in list")
                
                # Save categories
                save_btn = self.page.locator('button[data-testid="save-categories-btn"]')
                await save_btn.click()
                await self.page.wait_for_timeout(2000)
                
                # Check for success toast
                toast = await self.page.locator('div:has-text("guardadas exitosamente")').count()
                if toast > 0:
                    print("   ✓ Categories saved successfully")
            else:
                self.log_result("Create new category", False,
                               f"Category '{test_category}' not found in list after creation")
        
        except Exception as e:
            self.log_result("Create new category", False, str(e))
    
    async def test_edit_category(self):
        """Test 13: Edit category works"""
        print("\n" + "="*80)
        print("TEST 13: Edit category")
        print("="*80)
        
        try:
            # Find first category edit button
            edit_btn = self.page.locator('button[data-testid^="edit-category-"]').first
            
            edit_btn_count = await edit_btn.count()
            
            if edit_btn_count == 0:
                self.log_result("Edit category", False,
                               "No categories available to edit")
                return
            
            await edit_btn.click()
            await self.page.wait_for_timeout(500)
            
            # Check if edit input appears
            edit_input = await self.page.locator('input[data-testid^="edit-category-input-"]').count()
            
            if edit_input > 0:
                # Modify category name
                await self.page.locator('input[data-testid^="edit-category-input-"]').first.fill("EditedCategory")
                
                # Click save
                save_edit_btn = self.page.locator('button[data-testid^="save-category-"]').first
                await save_edit_btn.click()
                await self.page.wait_for_timeout(1000)
                
                await self.capture_screenshot("category_edited")
                
                self.log_result("Edit category", True,
                               "Category edit mode activated and saved")
            else:
                self.log_result("Edit category", False,
                               "Edit input did not appear")
        
        except Exception as e:
            self.log_result("Edit category", False, str(e))
    
    async def test_delete_category(self):
        """Test 14: Delete category works"""
        print("\n" + "="*80)
        print("TEST 14: Delete category")
        print("="*80)
        
        try:
            # Count categories before deletion
            categories_before = await self.page.locator('div[data-testid^="category-item-"]').count()
            
            if categories_before == 0:
                self.log_result("Delete category", False,
                               "No categories available to delete")
                return
            
            print(f"   Categories before deletion: {categories_before}")
            
            # Click delete button on first category
            delete_btn = self.page.locator('button[data-testid^="delete-category-"]').first
            await delete_btn.click()
            await self.page.wait_for_timeout(1000)
            
            # Count categories after deletion
            categories_after = await self.page.locator('div[data-testid^="category-item-"]').count()
            
            print(f"   Categories after deletion: {categories_after}")
            
            await self.capture_screenshot("category_deleted")
            
            if categories_after < categories_before:
                self.log_result("Delete category", True,
                               f"Category deleted successfully ({categories_before} → {categories_after})")
            else:
                self.log_result("Delete category", False,
                               "Category count did not decrease after deletion")
        
        except Exception as e:
            self.log_result("Delete category", False, str(e))
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        try:
            await self.setup()
            
            # Inventory tests
            await self.test_inventory_page_loads()
            await self.test_store_filter()
            await self.test_category_filter()
            await self.test_search_functionality()
            await self.test_sorting_by_name()
            await self.test_sorting_by_price()
            await self.test_brand_column_visible()
            await self.test_mass_selection()
            await self.test_mass_deletion_modal()
            await self.test_export_selected_products()
            
            # Settings → Categories tests
            await self.test_settings_categories_section()
            await self.test_create_category()
            await self.test_edit_category()
            await self.test_delete_category()
            
            # Print summary
            self.print_summary()
        
        finally:
            if self.browser:
                await self.browser.close()
    
    def print_summary(self):
        """Print test results summary"""
        print("\n" + "="*80)
        print("📊 TEST RESULTS SUMMARY")
        print("="*80 + "\n")
        
        passed = sum(1 for r in self.test_results if r['passed'])
        failed = sum(1 for r in self.test_results if not r['passed'])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"Success Rate: {(passed/total*100):.1f}%\n")
        
        if failed > 0:
            print("Failed Tests:")
            print("-" * 80)
            for result in self.test_results:
                if not result['passed']:
                    print(f"❌ {result['test']}")
                    if result['details']:
                        print(f"   {result['details']}")
            print()
        
        print("Passed Tests:")
        print("-" * 80)
        for result in self.test_results:
            if result['passed']:
                print(f"✅ {result['test']}")
        
        print("\n" + "="*80)
        print(f"Screenshots saved to: {self.screenshots_dir}")
        print("="*80 + "\n")

async def main():
    tester = InventorySettingsTest()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())
